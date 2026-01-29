-- Create budgets_recurring table
CREATE TABLE public.budgets_recurring (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
  subcategory_id UUID REFERENCES public.subcategories(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL DEFAULT 0,
  frequency TEXT NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly')),
  start_month TEXT NOT NULL, -- Format: YYYY-MM
  end_month TEXT, -- Format: YYYY-MM or null for indefinite
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  -- Ensure at least category_id is provided
  CONSTRAINT budgets_recurring_category_check CHECK (category_id IS NOT NULL)
);

-- Enable RLS
ALTER TABLE public.budgets_recurring ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view recurring budgets in their household"
ON public.budgets_recurring
FOR SELECT
USING (household_id = get_user_household_id());

CREATE POLICY "Users can insert recurring budgets"
ON public.budgets_recurring
FOR INSERT
WITH CHECK (household_id = get_user_household_id());

CREATE POLICY "Users can update recurring budgets"
ON public.budgets_recurring
FOR UPDATE
USING (household_id = get_user_household_id());

CREATE POLICY "Users can delete recurring budgets"
ON public.budgets_recurring
FOR DELETE
USING (household_id = get_user_household_id());

-- Add trigger for updated_at
CREATE TRIGGER update_budgets_recurring_updated_at
BEFORE UPDATE ON public.budgets_recurring
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add column to budgets table to track if it was manually edited
ALTER TABLE public.budgets ADD COLUMN is_manual BOOLEAN NOT NULL DEFAULT false;

-- Add column to track which recurring budget generated this entry
ALTER TABLE public.budgets ADD COLUMN recurring_budget_id UUID REFERENCES public.budgets_recurring(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX idx_budgets_recurring_household ON public.budgets_recurring(household_id);
CREATE INDEX idx_budgets_recurring_id ON public.budgets(recurring_budget_id);