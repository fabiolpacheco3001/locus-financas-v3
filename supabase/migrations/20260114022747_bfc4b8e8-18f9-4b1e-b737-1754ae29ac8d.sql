-- Add expense_type column (nullable, for expenses only)
ALTER TABLE public.transactions 
ADD COLUMN expense_type text;

-- Add due_date column (nullable)
ALTER TABLE public.transactions 
ADD COLUMN due_date date;

-- Add check constraint for expense_type values
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_expense_type_check 
CHECK (expense_type IS NULL OR expense_type IN ('fixed', 'variable'));

-- Drop the old constraint that only allowed INCOME to be planned
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS transactions_planned_income_only;

-- Add new constraint: planned status rules
-- planned is allowed for: INCOME (any), or EXPENSE with expense_type='fixed'
-- TRANSFER always confirmed, EXPENSE variable always confirmed
ALTER TABLE public.transactions 
ADD CONSTRAINT transactions_planned_status_rules 
CHECK (
  status = 'confirmed' 
  OR kind = 'INCOME' 
  OR (kind = 'EXPENSE' AND expense_type = 'fixed')
);

-- Set default expense_type for existing expenses
UPDATE public.transactions 
SET expense_type = 'variable' 
WHERE kind = 'EXPENSE' AND expense_type IS NULL;