-- SQL Migration: Add global currency preference to user profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS default_currency TEXT DEFAULT 'USD';

-- Optional: Update existing profiles to have USD if they are null
UPDATE public.profiles 
SET default_currency = 'USD' 
WHERE default_currency IS NULL;

-- Update expenses table default currency fallback
ALTER TABLE public.expenses 
ALTER COLUMN currency SET DEFAULT 'USD';
