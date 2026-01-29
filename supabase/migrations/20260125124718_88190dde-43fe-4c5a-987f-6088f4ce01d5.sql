-- Add clean_description column to transactions table for AI-processed names
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS clean_description text;

-- Create index for faster lookups on clean_description
CREATE INDEX IF NOT EXISTS idx_transactions_clean_description 
ON public.transactions(clean_description) 
WHERE clean_description IS NOT NULL;