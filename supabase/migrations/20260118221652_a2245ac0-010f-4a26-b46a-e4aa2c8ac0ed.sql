-- Add unique constraint for idempotency: prevent duplicate transactions for same recurring + month
-- We'll use a partial unique index on recurring_transaction_id + date truncated to month
-- This ensures only one transaction per recurring template per month

CREATE UNIQUE INDEX idx_recurring_transaction_month_unique 
ON public.transactions (recurring_transaction_id, date_trunc('month', date::timestamp))
WHERE recurring_transaction_id IS NOT NULL AND cancelled_at IS NULL;