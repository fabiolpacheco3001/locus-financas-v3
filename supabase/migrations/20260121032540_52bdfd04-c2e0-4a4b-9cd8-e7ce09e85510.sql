-- =============================================
-- Credit Cards Management Feature
-- =============================================

-- Create credit_cards table
CREATE TABLE public.credit_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  limit_amount NUMERIC NOT NULL DEFAULT 0,
  closing_day INTEGER NOT NULL CHECK (closing_day >= 1 AND closing_day <= 31),
  due_day INTEGER NOT NULL CHECK (due_day >= 1 AND due_day <= 31),
  color TEXT DEFAULT '#6366f1',
  brand TEXT, -- visa, mastercard, elo, etc.
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on credit_cards
ALTER TABLE public.credit_cards ENABLE ROW LEVEL SECURITY;

-- RLS Policies for credit_cards
CREATE POLICY "Users can view credit cards in their household"
ON public.credit_cards FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert credit cards"
ON public.credit_cards FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update credit cards"
ON public.credit_cards FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete credit cards"
ON public.credit_cards FOR DELETE
USING (household_id = get_user_household_id());

-- Add payment_method and credit_card_id columns to transactions
ALTER TABLE public.transactions 
ADD COLUMN payment_method TEXT DEFAULT 'debit',
ADD COLUMN credit_card_id UUID REFERENCES public.credit_cards(id) ON DELETE SET NULL,
ADD COLUMN invoice_month TEXT; -- YYYY-MM format to track which invoice this belongs to

-- Create index for faster lookups
CREATE INDEX idx_transactions_credit_card_id ON public.transactions(credit_card_id);
CREATE INDEX idx_transactions_invoice_month ON public.transactions(invoice_month);
CREATE INDEX idx_credit_cards_household_id ON public.credit_cards(household_id);

-- Trigger to update updated_at on credit_cards
CREATE TRIGGER update_credit_cards_updated_at
BEFORE UPDATE ON public.credit_cards
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();