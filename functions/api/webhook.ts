
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const updateProfile = async (env: Env, userId: string, planId: string, customerId: string, subId?: string, subItemId?: string) => {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const limits: Record<string, number> = { 'basic': 40, 'pro': 120, 'business': 500 };

  const updates: any = {
    plan_id: planId,
    is_trial_active: false,
    subscription_expiry: Date.now() + (31 * 24 * 60 * 60 * 1000),
    stripe_customer_id: customerId,
    monthly_docs_limit: limits[planId] || 100,
  };

  if (subId) updates.subscription_id = subId;
  if (subItemId) updates.subscription_item_id = subItemId;

  // If this is a new subscription, we might want to reset the usage count?
  // Safest to NOT reset here if it's an existing user upgrading mid-month unless we want to grant full quota immediately.
  // For now, we only update the limit. The monthly reset handles the zeroing.

  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);

  if (error) {
    console.error("Webhook Supabase Error:", error);
    return false;
  }
  return true;
};

// Fix: Use standard function signature instead of PagesFunction type which is not recognized in this environment
export async function onRequestPost(context: { env: Env; request: Request }) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
    httpClient: Stripe.createFetchHttpClient(),
  });

  const sig = context.request.headers.get('stripe-signature');
  const body = await context.request.text();
  let stripeEvent;

  try {
    stripeEvent = await stripe.webhooks.constructEventAsync(
      body,
      sig || '',
      context.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err: any) {
    return new Response(`Webhook Error: ${err.message}`, { status: 400 });
  }

  try {
    if (stripeEvent.type === 'checkout.session.completed') {
      const session = stripeEvent.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.userId;
      const planId = session.metadata?.planId || 'pro';
      const customerId = session.customer as string;
      const subscriptionId = session.subscription as string;

      console.log(`Webhook: Checkout ${session.id}. User: ${userId}, Plan: ${planId}`);

      if (userId) {
        // Fetch subscription to get items logic
        let subItemId = undefined;
        if (subscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(subscriptionId);
            const meteredItem = sub.items.data.find(item => item.price.recurring?.usage_type === 'metered');
            subItemId = meteredItem ? meteredItem.id : sub.items.data[0]?.id;
          } catch (e) {
            console.error("Failed to retrieve sub details:", e);
          }
        }
        await updateProfile(context.env, userId, planId, customerId, subscriptionId, subItemId);
      }
    }

    if (stripeEvent.type === 'customer.subscription.created') {
      // logic merged into checkout.session.completed usually, but good fallback
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      console.log(`Webhook: Sub Created ${subscription.id}`);
      // We skip doing the heavy lifting here as checkout.session.completed covers the metadata mapping better usually
      // unless this is a renewal/update? specific logic can be added if needed.
    }

    if (stripeEvent.type === 'invoice.payment_succeeded') {
      const invoice = stripeEvent.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      const subscriptionId = invoice.subscription as string;

      if (invoice.billing_reason === 'subscription_cycle') {
        console.log(`Webhook: Monthly Reset for Customer ${customerId}`);
        const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

        // Reset usage and extend expiry
        const { error } = await supabase
          .from('profiles')
          .update({
            docs_used_this_month: 0,
            last_billed_usage: 0,
            subscription_expiry: Date.now() + (31 * 24 * 60 * 60 * 1000)
          })
          .eq('stripe_customer_id', customerId);

        if (error) console.error("Weekly Reset Error:", error);
      }
    }

    if (stripeEvent.type === 'customer.subscription.deleted') {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;
      console.log(`Webhook: Subscription Deleted for Customer ${customerId}`);

      const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);
      const { error } = await supabase
        .from('profiles')
        .update({
          subscription_expiry: 0, // Immediately expire
          plan_id: 'free'
        })
        .eq('stripe_customer_id', customerId);

      if (error) console.error("Webhook Deletion Error:", error);
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    console.error("Webhook Internal Error:", err.message);
    return new Response(`Internal Server Error: ${err.message}`, { status: 500 });
  }
}