-- Add is_primary column to accounts table (default false)
ALTER TABLE public.accounts 
ADD COLUMN is_primary boolean NOT NULL DEFAULT false;

-- Create function to ensure only one primary account per household
CREATE OR REPLACE FUNCTION public.ensure_single_primary_account()
RETURNS TRIGGER AS $$
BEGIN
  -- If setting is_primary to true, unset all other accounts in the same household
  IF NEW.is_primary = true THEN
    UPDATE public.accounts 
    SET is_primary = false 
    WHERE household_id = NEW.household_id 
      AND id != NEW.id 
      AND is_primary = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- Create trigger to enforce single primary account
CREATE TRIGGER ensure_single_primary_account_trigger
BEFORE INSERT OR UPDATE OF is_primary ON public.accounts
FOR EACH ROW
WHEN (NEW.is_primary = true)
EXECUTE FUNCTION public.ensure_single_primary_account();