
import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  SITE_URL: string;
}

// Fix: Use standard function signature instead of PagesFunction type which is not recognized in this environment
export async function onRequestPost(context: { env: Env; request: Request }) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const { customerId }: any = await context.request.json();

    if (!customerId) {
      return new Response(
        JSON.stringify({ error: "No customer ID provided. You must have a paid subscription to access the portal." }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const origin = new URL(context.request.url).origin;
    const returnUrl = context.env.SITE_URL || origin;

    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message || "Failed to create portal session" }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}