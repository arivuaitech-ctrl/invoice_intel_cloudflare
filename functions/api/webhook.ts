
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const updateProfile = async (env: Env, userId: string, planId: string, customerId: string) => {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const limits: Record<string, number> = {
    'basic': 30,
    'pro': 100,
    'business': 500
  };

  const { data, error } = await supabase
    .from('profiles')
    .update({
      plan_id: planId,
      is_trial_active: false,
      subscription_expiry: Date.now() + (31 * 24 * 60 * 60 * 1000),
      stripe_customer_id: customerId,
      monthly_docs_limit: limits[planId] || 100,
      docs_used_this_month: 0
    })
    .eq('id', userId)
    .select();

  if (error) {
    console.error("Webhook Supabase Error:", error);
    return false;
  }

  return data && data.length > 0;
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

      if (userId) {
        await updateProfile(context.env, userId, planId, customerId);
      }
    }

    if (stripeEvent.type === 'customer.subscription.created') {
      const subscription = stripeEvent.data.object as Stripe.Subscription;
      const customerId = subscription.customer as string;

      const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 1 });
      if (sessions.data.length > 0) {
        const session = sessions.data[0];
        const userId = session.metadata?.userId;
        const planId = session.metadata?.planId || 'pro';
        if (userId) {
          await updateProfile(context.env, userId, planId, customerId);
        }
      }
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (err: any) {
    return new Response("Internal Server Error", { status: 500 });
  }
}