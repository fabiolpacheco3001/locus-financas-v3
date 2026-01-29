-- Add cancelled_at column for tracking cancelled transactions
ALTER TABLE public.transactions ADD COLUMN cancelled_at TIMESTAMP WITH TIME ZONE NULL;