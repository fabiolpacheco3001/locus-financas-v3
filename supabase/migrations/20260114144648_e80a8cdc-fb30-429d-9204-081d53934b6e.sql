-- Drop the old constraint that doesn't account for installments
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS transactions_planned_status_rules;

-- Add the updated constraint that allows planned status for installments
ALTER TABLE public.transactions ADD CONSTRAINT transactions_planned_status_rules 
CHECK (
  status = 'confirmed' 
  OR kind = 'INCOME' 
  OR (kind = 'EXPENSE' AND expense_type = 'fixed')
  OR (kind = 'EXPENSE' AND installment_group_id IS NOT NULL)
);