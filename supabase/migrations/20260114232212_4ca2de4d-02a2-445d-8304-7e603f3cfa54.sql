-- Drop the old constraint that doesn't include 'cancelled'
ALTER TABLE public.transactions DROP CONSTRAINT transactions_status_check;

-- Add new constraint accepting planned, confirmed, and cancelled
ALTER TABLE public.transactions
  ADD CONSTRAINT transactions_status_check
  CHECK (status IN ('planned', 'confirmed', 'cancelled'));