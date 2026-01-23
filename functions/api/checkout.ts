
import Stripe from 'stripe';

interface Env {
  STRIPE_SECRET_KEY: string;
  STRIPE_PRICE_ID_BASIC: string;
  STRIPE_PRICE_ID_PRO: string;
  STRIPE_PRICE_ID_BUSINESS: string;
  SITE_URL: string;
}

// Fix: Use standard function signature instead of PagesFunction type which is not recognized in this environment
export async function onRequestPost(context: { env: Env; request: Request }) {
  const stripe = new Stripe(context.env.STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
    httpClient: Stripe.createFetchHttpClient(),
  });

  try {
    const body: any = await context.request.json();
    const { priceId, userId, userEmail, currency = 'myr', isMobile = false } = body;

    const priceMap: Record<string, string | undefined> = {
      'basic': context.env.STRIPE_PRICE_ID_BASIC,
      'pro': context.env.STRIPE_PRICE_ID_PRO,
      'business': context.env.STRIPE_PRICE_ID_BUSINESS,
    };

    const stripePriceId = priceMap[priceId];

    if (!stripePriceId || !stripePriceId.startsWith('price_')) {
      return new Response(
        JSON.stringify({ error: `Configuration Error: Price ID for '${priceId}' is missing in environment variables.` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const origin = new URL(context.request.url).origin;
    const cleanBaseUrl = context.env.SITE_URL || origin;

    // Use mobile bridge page if request is from the mobile app
    // This avoids browsers blocking the custom protocol redirect directly from Stripe
    const successUrl = isMobile
      ? `${cleanBaseUrl}/?mode=mobile_bridge&payment=success&session_id={CHECKOUT_SESSION_ID}`
      : `${cleanBaseUrl}/?session_id={CHECKOUT_SESSION_ID}&payment=success`;
    const cancelUrl = isMobile
      ? `${cleanBaseUrl}/?mode=mobile_bridge&payment=cancelled`
      : `${cleanBaseUrl}/?payment=cancelled`;

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price: stripePriceId,
        quantity: 1
      }],
      currency: currency.toLowerCase(), // Important: Specify currency for multi-currency prices
      mode: 'subscription',
      success_url: successUrl,
      cancel_url: cancelUrl,
      customer_email: userEmail,
      metadata: {
        userId,
        planId: priceId
      },
      allow_promotion_codes: true,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}