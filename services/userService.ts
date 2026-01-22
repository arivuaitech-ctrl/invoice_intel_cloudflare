
import { UserProfile, PricingTier } from '../types';
import { supabase } from './supabaseClient';
import { Capacitor } from '@capacitor/core';

export const PRICING_PACKAGES: PricingTier[] = [
  {
    id: 'basic',
    name: 'Personal (Basic)',
    limit: 30,
    price: 16.00,
    priceUSD: 5.00,
    description: 'For individuals managing monthly bills.',
    features: ['30 Receipts / Month', 'Standard Processing', 'Excel Export'],
    popular: false
  },
  {
    id: 'pro',
    name: 'Freelancer (Pro)',
    limit: 100,
    price: 40.00,
    priceUSD: 10.00,
    description: 'For agents, freelancers & power users.',
    features: ['100 Receipts / Month', 'Priority AI Processing', 'Spending Analytics'],
    popular: true
  },
  {
    id: 'business',
    name: 'SME Business',
    limit: 500,
    price: 90.00,
    priceUSD: 20.00,
    description: 'For small businesses and teams.',
    features: ['500 Receipts / Month', 'High-Speed Bulk Upload', 'Priority Support'],
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
  isAdmin: !!data.is_admin,
  hasConsented: !!data.has_consented,
  consentTimestamp: data.consent_timestamp,
  consentVersion: data.consent_version,
  consentIp: data.consent_ip,
  defaultCurrency: data.default_currency || 'USD'
});

export const userService = {
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

  canUpload: (user: UserProfile, fileCount: number): { allowed: boolean; reason?: 'trial_limit' | 'plan_limit' | 'expired' } => {
    if (user.isAdmin) return { allowed: true };

    if (user.isTrialActive && user.planId === 'free') {
      if (user.docsUsedThisMonth + fileCount > user.monthlyDocsLimit) return { allowed: false, reason: 'trial_limit' };
      return { allowed: true };
    }
    if (user.planId !== 'free') {
      // Allow a grace period of 2 hours if expiry is just reached
      const gracePeriod = 2 * 60 * 60 * 1000;
      if (user.subscriptionExpiry && (Date.now() > user.subscriptionExpiry + gracePeriod)) return { allowed: false, reason: 'expired' };
      if (user.docsUsedThisMonth + fileCount > user.monthlyDocsLimit) return { allowed: false, reason: 'plan_limit' };
      return { allowed: true };
    }
    return { allowed: false, reason: 'expired' };
  },

  recordUsage: async (user: UserProfile, fileCount: number): Promise<UserProfile> => {
    const newCount = (user.docsUsedThisMonth || 0) + fileCount;
    const { data, error } = await supabase
      .from('profiles')
      .update({ docs_used_this_month: newCount })
      .eq('id', user.id)
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
