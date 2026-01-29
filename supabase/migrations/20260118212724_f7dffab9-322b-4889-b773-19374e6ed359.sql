-- Add is_reserve column to accounts table
-- Accounts marked as reserve are excluded from available balance calculations
ALTER TABLE public.accounts
ADD COLUMN is_reserve BOOLEAN NOT NULL DEFAULT false;

-- Add index for better query performance when filtering by reserve status
CREATE INDEX idx_accounts_is_reserve ON public.accounts(is_reserve);

-- Comment for clarity
COMMENT ON COLUMN public.accounts.is_reserve IS 'When true, this account is a reserve/piggy bank and excluded from available balance calculations';

-- Create table for recurring transactions
CREATE TABLE public.recurring_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  
  -- Transaction template fields
  kind public.transaction_kind NOT NULL,
  amount NUMERIC NOT NULL,
  description TEXT,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  to_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE SET NULL,
  member_id UUID REFERENCES public.members(id) ON DELETE SET NULL,
  expense_type TEXT, -- 'fixed' or 'variable'
  
  -- Recurrence config
  frequency TEXT NOT NULL DEFAULT 'monthly', -- MVP: only 'monthly'
  day_of_month INTEGER NOT NULL DEFAULT 1, -- Day of month for the transaction
  start_month TEXT NOT NULL, -- YYYY-MM format
  end_month TEXT, -- YYYY-MM format, NULL means indefinite
  
  -- Status
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.recurring_transactions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view recurring transactions in their household" 
ON public.recurring_transactions 
FOR SELECT 
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert recurring transactions" 
ON public.recurring_transactions 
FOR INSERT 
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update recurring transactions" 
ON public.recurring_transactions 
FOR UPDATE 
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete recurring transactions" 
ON public.recurring_transactions 
FOR DELETE 
USING (household_id = get_user_household_id());

-- Add trigger for updated_at
CREATE TRIGGER update_recurring_transactions_updated_at
BEFORE UPDATE ON public.recurring_transactions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add recurring_transaction_id to transactions table to link generated transactions
ALTER TABLE public.transactions
ADD COLUMN recurring_transaction_id UUID REFERENCES public.recurring_transactions(id) ON DELETE SET NULL;

-- Add index for faster lookups
CREATE INDEX idx_transactions_recurring_transaction_id ON public.transactions(recurring_transaction_id);

-- Comment for clarity
COMMENT ON COLUMN public.transactions.recurring_transaction_id IS 'Links to the recurring transaction template that generated this transaction';
COMMENT ON TABLE public.recurring_transactions IS 'Stores recurring transaction templates for automatic generation';