-- Add status column to transactions (default 'confirmed')
ALTER TABLE public.transactions 
ADD COLUMN status text NOT NULL DEFAULT 'confirmed';

-- Add confirmed_at column (nullable)
ALTER TABLE public.transactions 
ADD COLUMN confirmed_at timestamp with time zone;

-- Add check constraint to ensure status is valid
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_status_check 
CHECK (status IN ('confirmed', 'planned'));

-- Add constraint: only INCOME can be 'planned'
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_planned_income_only 
CHECK (status = 'confirmed' OR kind = 'INCOME');

-- Set confirmed_at for existing confirmed transactions
UPDATE public.transactions 
SET confirmed_at = created_at 
WHERE status = 'confirmed';