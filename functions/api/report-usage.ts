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
            .select('subscription_item_id, last_billed_usage, custom_usage_limit')
            .eq('id', userId)
            .single();

        if (error || !profile) {
            return new Response(JSON.stringify({ error: "Profile not found" }), { status: 404 });
        }

        const { subscription_item_id, last_billed_usage, custom_usage_limit } = profile;

        if (!subscription_item_id) {
            return new Response(JSON.stringify({ ignored: true, reason: "No subscription item" }), { status: 200 });
        }

        // 2. Check Custom Limit
        if (custom_usage_limit && usage > custom_usage_limit) {
            return new Response(JSON.stringify({ error: "Custom usage limit exceeded" }), { status: 403 });
        }

        // 3. New Logic: Report Total Usage Incrementally
        // We trust Stripe's Tiered Logic (Per Unit / Graduated) to handle the pricing
        // We simply report how many *new* items were added since last report.

        // Fallback: If last_billed_usage > usage (e.g. manual reset?), we should report 0 or ignore?
        // Stripe Usage API is additive (action='increment').
        // So we need to calculate delta = usage - last_billed_usage.

        const previousBilled = last_billed_usage || 0;
        const delta = usage - previousBilled;

        if (delta > 0) {
            console.log(`Report Usage for User ${userId}: Delta ${delta} (Total ${usage})`);

            const idempotencyKey = `usage_${subscription_item_id}_${usage}_${Date.now()}`;

            await stripe.subscriptionItems.createUsageRecord(
                subscription_item_id,
                {
                    quantity: delta,
                    timestamp: Math.floor(Date.now() / 1000),
                    action: 'increment',
                },
                {
                    idempotencyKey
                }
            );

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
