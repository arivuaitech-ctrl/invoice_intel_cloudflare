-- Add receipt_id column to expenses table
ALTER TABLE public.expenses
ADD COLUMN receipt_id TEXT;

-- Comment on column
COMMENT ON COLUMN public.expenses.receipt_id IS 'Extracted Receipt Number or Invoice Number';
