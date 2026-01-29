-- Drop the overly restrictive check constraint that blocks planned variable expenses
ALTER TABLE public.transactions DROP CONSTRAINT transactions_planned_status_rules;

-- Add a simpler, more permissive constraint that allows any transaction to be planned
-- The business rule is: any transaction can be planned (pending) or confirmed (paid)
-- No restriction on expense_type for planned status
COMMENT ON TABLE public.transactions IS 'Transactions table with flexible planned/confirmed status - expense_type no longer restricts planned status';