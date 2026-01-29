
import { UserProfile, PricingTier } from '../types';
import { supabase } from './supabaseClient';
import { Capacitor } from '@capacitor/core';

// METERED PLAN CONFIG
export const PRICING_PACKAGES: PricingTier[] = [
  {
    id: 'basic',
    name: 'Basic (Individuals)',
    limit: 40,
    price: 0, // Legacy field, ignored now
    priceUSD: 5.00,
    description: 'For individuals managing personal expenses.',
    features: ['40 Receipts / Month', 'AI Invoice Extraction', 'Export (CSV / Excel)'],
    popular: false
  },
  {
    id: 'pro',
    name: 'Pro (Freelancer)',
    limit: 120,
    price: 0,
    priceUSD: 12.00,
    description: 'For freelancers requiring higher volume.',
    features: ['120 Receipts / Month', 'AI Invoice Extraction', 'Export (CSV / Excel)'],
    popular: true
  },
  {
    id: 'business',
    name: 'Business (SMEs)',
    limit: 500, // Base limit, overage applies after this
    price: 0,
    priceUSD: 25.00,
    description: 'For small businesses and teams.',
    features: ['500 Receipts Included', 'Metered Usage ($5 per 100 extra)', 'Bulk Upload', '$10 One-time Setup Fee', 'Priority Support'],
    popular: false
  }
];

const mapProfile = (data: any): UserProfile => ({
  id: data.id,
  name: data.name,
  email: data.email,
  avatarUrl: data.avatar_url,
  planId: data.plan_id || 'free',
  subscriptionExpiry: data.subscription_expiry,
  monthlyDocsLimit: typeof data.monthly_docs_limit === 'number' ? data.monthly_docs_limit : 10,
  docsUsedThisMonth: data.docs_used_this_month || 0,
  trialStartDate: data.trial_start_date,
  isTrialActive: data.is_trial_active,
  stripeCustomerId: data.stripe_customer_id,
  subscriptionId: data.subscription_id,
  subscriptionItemId: data.subscription_item_id,
  customUsageLimit: data.custom_usage_limit,
  lastBilledUsage: data.last_billed_usage,
  isAdmin: !!data.is_admin,
  hasConsented: !!data.has_consented,
  consentTimestamp: data.consent_timestamp,
  consentVersion: data.consent_version,
  consentIp: data.consent_ip,
  defaultCurrency: 'USD' // Force USD always
});

export const userService = {
  getTotalUserCount: async (): Promise<number> => {
    const { count, error } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true });

    if (error) {
      console.error('Error counting users:', error);
      return 0; // Fail-open: allow registration if count fails
    }
    return count || 0;
  },

  updateConsent: async (userId: string, version: string = '1.0'): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('profiles')
      .update({
        has_consented: true,
        consent_timestamp: Date.now(),
        consent_version: version
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) throw error;
    return mapProfile(data);
  },
  getProfile: async (userId: string): Promise<UserProfile | null> => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error || !data) return null;
      return userService.refreshUserStatus(mapProfile(data));
    } catch (e) {
      console.error("getProfile error:", e);
      return null;
    }
  },

  login: async () => {
    const isNative = Capacitor.isNativePlatform();
    const redirectTo = isNative
      ? 'com.arivuaitech.invoiceintel://auth/callback'
      : window.location.origin;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectTo
      }
    });
    if (error) throw error;
  },

  loginWithEmail: async (email: string) => {
    const isNative = Capacitor.isNativePlatform();
    const redirectTo = isNative
      ? 'com.arivuaitech.invoiceintel://auth/callback'
      : window.location.origin;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: redirectTo
      }
    });
    if (error) throw error;
  },

  verifyOtp: async (email: string, token: string) => {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email'
    });
    if (error) throw error;
    return data;
  },

  logout: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) console.error("Signout error:", error);
  },

  upsertProfile: async (authUser: any): Promise<UserProfile> => {
    const { data: existing } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', authUser.id)
      .single();

    if (existing) {
      const profile = mapProfile(existing);

      // FIX: If profile exists but trial was never properly initialized (limit 0 or no date)
      if (profile.planId === 'free' && (profile.monthlyDocsLimit === 0 || !profile.trialStartDate)) {
        console.log(`[UserService] Repairing hollow profile for ${profile.email}`);
        const repaired = {
          monthly_docs_limit: 10,
          trial_start_date: Date.now(),
          is_trial_active: true
        };
        const { data: updated } = await supabase
          .from('profiles')
          .update(repaired)
          .eq('id', profile.id)
          .select()
          .single();
        if (updated) return userService.refreshUserStatus(mapProfile(updated));
      }
      return userService.refreshUserStatus(profile);
    }

    // NEW USER: Check registration limit (250 users)
    const totalUsers = await userService.getTotalUserCount();
    console.log(`[UserService] Total users: ${totalUsers}`);

    if (totalUsers >= 250) {
      console.warn(`[UserService] Registration limit reached. Denying access to ${authUser.email}`);
      throw new Error('REGISTRATION_LIMIT_REACHED');
    }

    const newProfile = {
      id: authUser.id,
      name: authUser.user_metadata?.full_name || authUser.email.split('@')[0],
      email: authUser.email,
      avatar_url: authUser.user_metadata?.avatar_url || `https://ui-avatars.com/api/?name=${authUser.email}&background=6366f1&color=fff`,
      plan_id: 'free',
      trial_start_date: Date.now(),
      is_trial_active: true,
      docs_used_this_month: 0,
      monthly_docs_limit: 10,
      is_admin: false
    };

    const { data, error } = await supabase
      .from('profiles')
      .upsert(newProfile)
      .select()
      .single();

    if (error) throw error;
    return userService.refreshUserStatus(mapProfile(data));
  },

  refreshUserStatus: (user: UserProfile): UserProfile => {
    let updated = { ...user };
    const now = Date.now();
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

    // Safety check: trial logic
    // If trialStartDate is 0 or missing, it's a new or broken user - initialize it
    if (updated.planId === 'free' && (!updated.trialStartDate || updated.trialStartDate === 0)) {
      updated.trialStartDate = now;
      updated.isTrialActive = true;
      if (updated.monthlyDocsLimit === 0) updated.monthlyDocsLimit = 10;
    }

    const isTrialExpired = (now - updated.trialStartDate) > SEVEN_DAYS_MS;

    if (updated.planId === 'free') {
      updated.isTrialActive = !isTrialExpired && !updated.isAdmin;
      // If trial is still active but docs limit is somehow 0, reset to trial default (10)
      if (updated.isTrialActive && updated.monthlyDocsLimit === 0) {
        updated.monthlyDocsLimit = 10;
      }
    } else {
      updated.isTrialActive = false;
    }

    // Only lock paid accounts if they have an actual expiry date set in the past
    if (user.planId !== 'free' && user.subscriptionExpiry) {
      if (now > user.subscriptionExpiry) {
        updated.planId = 'free';
        updated.monthlyDocsLimit = 0; // Lock account on true expiry
        updated.subscriptionExpiry = null;
        updated.isTrialActive = false;
      }
    }

    return updated;
  },

  canUpload: (user: UserProfile, fileCount: number): { allowed: boolean; reason?: 'trial_limit' | 'plan_limit' | 'expired' | 'custom_limit' } => {
    if (user.isAdmin) return { allowed: true };

    const futureUsage = (user.docsUsedThisMonth || 0) + fileCount;

    // Trial check
    if (user.isTrialActive && user.planId === 'free') {
      if (futureUsage > user.monthlyDocsLimit) return { allowed: false, reason: 'trial_limit' };
      return { allowed: true };
    }

    // Subscription check
    if (user.planId !== 'free') {
      // Allow a grace period of 28 hours if expiry is just reached (payment retry window)
      const gracePeriod = 28 * 60 * 60 * 1000;
      if (user.subscriptionExpiry && (Date.now() > user.subscriptionExpiry + gracePeriod)) {
        return { allowed: false, reason: 'expired' };
      }

      // Check Business User Custom Limit (Hard Stop)
      if (user.planId === 'business' && user.customUsageLimit && futureUsage > user.customUsageLimit) {
        return { allowed: false, reason: 'custom_limit' };
      }

      // Start Overage check logic
      if (user.planId === 'business') {
        // Business users rely on metered billing for overage, so we allow unless hard custom limit hit
        return { allowed: true };
      }

      // Regular Plan Limit
      if (futureUsage > user.monthlyDocsLimit) {
        return { allowed: false, reason: 'plan_limit' };
      }

      return { allowed: true };
    }
    return { allowed: false, reason: 'expired' };
  },

  recordUsage: async (user: UserProfile, fileCount: number): Promise<UserProfile> => {
    const newCount = (user.docsUsedThisMonth || 0) + fileCount;

    // 1. Update Database
    const { data, error } = await supabase
      .from('profiles')
      .update({ docs_used_this_month: newCount })
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;

    // 2. Report Usage to Stripe if Business Plan and over limit
    // We report usage for *every* upload if they are on metered plan, OR only if above limit?
    // Stripe "metered" usage usually requires reporting ALL usage, OR delta.
    // However, our model is: Included 500, then metered.
    // If Stripe Price is configured as "Cluster" or "Tiered", we might report everything.
    // BUT simplest approach: If user is Business, we report the *increment* (fileCount) to the endpoint.
    // The Endpoint will check if it needs to report to Stripe based on total usage vs limit, 
    // OR if the Stripe Price is "Overage Only", we only report if total > 500.
    // Let's delegate this logic to the backend to keep client secret safe.

    // 2. Report Usage to API for Block Billing ($5 / 100 extra)
    if (user.planId === 'business' && user.subscriptionItemId) {
      console.log(`[UserService] Reporting usage for business user. Count: ${newCount}, SubItemID: ${user.subscriptionItemId}`);

      const API_BASE_URL = Capacitor.isNativePlatform()
        ? ((import.meta as any).env?.VITE_API_URL || '')
        : '';

      fetch(`${API_BASE_URL}/api/report-usage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          usage: newCount
        })
      }).then(res => {
        console.log(`[UserService] Report Usage Response:`, res.status);
      }).catch(e => console.error("Billing Report Failed:", e));
    } else {
      console.log(`[UserService] Omit reporting. Plan: ${user.planId}, SubItem: ${user.subscriptionItemId}`);
    }

    return mapProfile(data);
  },

  updateCustomLimit: async (userId: string, limit: number | null): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ custom_usage_limit: limit })
      .eq('id', userId)
      .select()
      .single();
    if (error) throw error;
    return mapProfile(data);
  },

  updateProfileCurrency: async (userId: string, newCurrency: string): Promise<UserProfile> => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ default_currency: newCurrency })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error("Profile currency update error:", error);
      throw error;
    }
    return mapProfile(data);
  }
};
