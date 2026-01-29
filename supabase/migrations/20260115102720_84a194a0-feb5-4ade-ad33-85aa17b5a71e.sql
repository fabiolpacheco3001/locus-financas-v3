-- Add audit columns for confirmed_by and cancelled_by
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS confirmed_by uuid REFERENCES public.members(id),
ADD COLUMN IF NOT EXISTS cancelled_by uuid REFERENCES public.members(id);

-- Add index for better performance on audit queries
CREATE INDEX IF NOT EXISTS idx_transactions_confirmed_by ON public.transactions(confirmed_by);
CREATE INDEX IF NOT EXISTS idx_transactions_cancelled_by ON public.transactions(cancelled_by);