-- Drop the existing constraint
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_planned_status_rules;

-- Add updated constraint that allows 'cancelled' status
ALTER TABLE public.transactions ADD CONSTRAINT transactions_planned_status_rules 
CHECK (
  status = 'confirmed' 
  OR status = 'cancelled'
  OR kind = 'INCOME' 
  OR (kind = 'EXPENSE' AND expense_type = 'fixed')
  OR (kind = 'EXPENSE' AND installment_group_id IS NOT NULL)
);