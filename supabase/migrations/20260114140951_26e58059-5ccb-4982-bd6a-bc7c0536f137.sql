-- Add installment fields to transactions table
ALTER TABLE public.transactions
ADD COLUMN installment_group_id UUID DEFAULT NULL,
ADD COLUMN installment_number INTEGER DEFAULT NULL,
ADD COLUMN installment_total INTEGER DEFAULT NULL;

-- Add index for installment_group_id for faster queries
CREATE INDEX idx_transactions_installment_group ON public.transactions (installment_group_id) WHERE installment_group_id IS NOT NULL;

-- Add check constraint to ensure installment fields are valid
ALTER TABLE public.transactions
ADD CONSTRAINT check_installment_fields CHECK (
  (installment_group_id IS NULL AND installment_number IS NULL AND installment_total IS NULL)
  OR
  (installment_group_id IS NOT NULL AND installment_number IS NOT NULL AND installment_total IS NOT NULL 
   AND installment_number >= 1 AND installment_number <= installment_total
   AND installment_total >= 2 AND installment_total <= 24)
);