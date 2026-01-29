-- Ensure expense_type column is nullable (safety check)
ALTER TABLE public.transactions 
ALTER COLUMN expense_type DROP NOT NULL;

-- Create a trigger to infer expense_type from category.is_essential if not provided
-- This preserves backwards compatibility with old code paths

CREATE OR REPLACE FUNCTION public.infer_expense_type()
RETURNS TRIGGER AS $$
BEGIN
  -- Only apply to EXPENSE transactions with NULL expense_type
  IF NEW.kind = 'EXPENSE' AND NEW.expense_type IS NULL THEN
    -- Try to infer from category's is_essential flag
    IF NEW.category_id IS NOT NULL THEN
      SELECT CASE WHEN is_essential THEN 'fixed' ELSE 'variable' END
      INTO NEW.expense_type
      FROM public.categories
      WHERE id = NEW.category_id;
    END IF;
    
    -- Default to 'variable' if still null
    IF NEW.expense_type IS NULL THEN
      NEW.expense_type := 'variable';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Drop existing trigger if exists (idempotent)
DROP TRIGGER IF EXISTS trigger_infer_expense_type ON public.transactions;

-- Create trigger BEFORE INSERT
CREATE TRIGGER trigger_infer_expense_type
  BEFORE INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.infer_expense_type();