-- Create RPC function to force update account balance (bypasses RLS with SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.force_update_account_balance(
  p_account_id uuid,
  p_new_balance numeric
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_household_id uuid;
BEGIN
  -- Verify the account belongs to the user's household (security check)
  SELECT household_id INTO v_household_id
  FROM public.accounts
  WHERE id = p_account_id;
  
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;
  
  IF v_household_id <> public.get_user_household_id() THEN
    RAISE EXCEPTION 'Access denied: account does not belong to your household';
  END IF;
  
  -- Perform the update
  UPDATE public.accounts
  SET current_balance = p_new_balance,
      updated_at = now()
  WHERE id = p_account_id;
  
  RAISE NOTICE 'Account % balance updated to %', p_account_id, p_new_balance;
END;
$$;