-- Create function to validate subcategory belongs to category
CREATE OR REPLACE FUNCTION public.validate_transaction_subcategory()
RETURNS TRIGGER AS $$
BEGIN
  -- Skip validation if subcategory_id is null
  IF NEW.subcategory_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Skip validation if category_id is null (should not happen, but defensive)
  IF NEW.category_id IS NULL THEN
    NEW.subcategory_id := NULL;
    RETURN NEW;
  END IF;
  
  -- Validate that subcategory belongs to the category
  IF NOT EXISTS (
    SELECT 1 FROM public.subcategories 
    WHERE id = NEW.subcategory_id 
    AND category_id = NEW.category_id
  ) THEN
    RAISE EXCEPTION 'Subcategory does not belong to the selected category';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger
DROP TRIGGER IF EXISTS validate_transaction_subcategory_trigger ON public.transactions;
CREATE TRIGGER validate_transaction_subcategory_trigger
BEFORE INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.validate_transaction_subcategory();