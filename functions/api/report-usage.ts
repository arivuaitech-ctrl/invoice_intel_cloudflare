import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

interface Env {
    STRIPE_SECRET_KEY: string;
    SUPABASE_URL: string;
    SUPABASE_SERVICE_ROLE_KEY: string;
}

export async function onRequestPost(context: { env: Env; request: Request }) {
    const stripe = new Stripe(context.env.STRIPE_SECRET_KEY, {
        apiVersion: '2023-10-16' as any,
        httpClient: Stripe.createFetchHttpClient(),
    });
    const supabase = createClient(context.env.SUPABASE_URL, context.env.SUPABASE_SERVICE_ROLE_KEY);

    try {
        const body: any = await context.request.json();
        const { userId, usage } = body; // usage = current total usage count

        if (!userId || usage === undefined) {
            return new Response(JSON.stringify({ error: "Missing userId or usage" }), { status: 400 });
        }

        // 1. Fetch Profile
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('stripe_customer_id, last_billed_usage, custom_usage_limit')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 });
        }

        const { stripe_customer_id, last_billed_usage, custom_usage_limit } = profile;

        if (!stripe_customer_id) {
            return new Response(JSON.stringify({ ignored: true, reason: "No Stripe Customer ID" }), { status: 200 });
        }

        // 2. Check Custom Limit
        if (custom_usage_limit && usage > custom_usage_limit) {
            return new Response(JSON.stringify({ error: "Custom usage limit exceeded" }), { status: 403 });
        }

        // 3. New Logic: Use Stripe Billing Meters API
        // We send events to Stripe whenever usage increases.
        // The "Event Name" must match the one in your Stripe Dashboard.

        const previousBilled = last_billed_usage || 0;
        const delta = usage - previousBilled;

        if (delta > 0) {
            console.log(`Reporting Meter Event for User ${userId}: Delta ${delta} (Total ${usage})`);

            const eventName = (context.env as any).STRIPE_METER_EVENT_NAME || 'invoice_counter';
            const idempotencyKey = `meter_event_${userId}_${usage}`;

            try {
                await stripe.billing.meterEvents.create(
                    {
                        event_name: eventName,
                        payload: {
                            stripe_customer_id: stripe_customer_id,
                            value: delta.toString(),
                        },
                        timestamp: Math.floor(Date.now() / 1000),
                    },
                    {
                        idempotencyKey
                    }
                );
            } catch (meterError: any) {
                console.error("Meter Event API Error:", meterError.message);
                // Fallback for older SDK versions
                await stripe.rawRequest('POST', '/v1/billing/meter_events', {
                    event_name: eventName,
                    payload: {
                        stripe_customer_id: stripe_customer_id,
                        value: delta.toString(),
                    },
                    timestamp: Math.floor(Date.now() / 1000),
                }, {
                    idempotencyKey: idempotencyKey
                });
            }

            // Update Database
            const { error: updateError } = await supabase
                .from('profiles')
                .update({ last_billed_usage: usage })
                .eq('id', userId);

            if (updateError) console.error("Failed to update last_billed_usage:", updateError);

            return new Response(JSON.stringify({ reported: true, delta }), { status: 200 });
        } else {
            return new Response(JSON.stringify({ reported: false, reason: "No new usage" }), { status: 200 });
        }

    } catch (err: any) {
        console.error("Report Usage Error:", err.message);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
