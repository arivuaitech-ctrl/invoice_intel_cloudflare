-- Add columns for Stripe Metered Billing and Subscription Tracking
-- custom_usage_limit: Allows Business users to set a hard cap on their usage.
-- last_billed_usage: Tracks the usage count that has already been reported/billed to Stripe (to prevent double-billing and handle blocks).
-- subscription_id: Tracks the Stripe Subscription ID.
-- subscription_item_id: Tracks the specific 'Metered' Subscription Item ID.

ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS subscription_id text,
ADD COLUMN IF NOT EXISTS subscription_item_id text,
ADD COLUMN IF NOT EXISTS custom_usage_limit integer DEFAULT NULL,
ADD COLUMN IF NOT EXISTS last_billed_usage integer DEFAULT 0;

-- Ensure default_currency is set
UPDATE profiles SET default_currency = 'USD' WHERE default_currency IS NULL;

-- Ensure last_billed_usage is initialized
UPDATE profiles SET last_billed_usage = 0 WHERE last_billed_usage IS NULL;
