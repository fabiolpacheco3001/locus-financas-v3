-- Create RPC function to delete recurring budget and cleanup related monthly budgets
CREATE OR REPLACE FUNCTION public.delete_recurring_budget_and_cleanup(
  p_recurring_id uuid,
  p_from_month text -- YYYY-MM format, or 'all' to delete all months
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_household_id uuid;
  v_from_year integer;
  v_from_month integer;
BEGIN
  -- Get household_id from the recurring budget to verify access
  SELECT household_id INTO v_household_id
  FROM public.budgets_recurring
  WHERE id = p_recurring_id
  AND household_id = get_user_household_id();
  
  IF v_household_id IS NULL THEN
    RAISE EXCEPTION 'Recurring budget not found or access denied';
  END IF;
  
  -- Delete monthly budgets based on the cutoff month
  IF p_from_month = 'all' THEN
    -- Delete all monthly budgets linked to this recurring budget
    DELETE FROM public.budgets
    WHERE recurring_budget_id = p_recurring_id;
  ELSE
    -- Parse the from_month
    v_from_year := split_part(p_from_month, '-', 1)::integer;
    v_from_month := split_part(p_from_month, '-', 2)::integer;
    
    -- Delete monthly budgets from the cutoff month onwards
    DELETE FROM public.budgets
    WHERE recurring_budget_id = p_recurring_id
    AND (year > v_from_year OR (year = v_from_year AND month >= v_from_month));
  END IF;
  
  -- Delete the recurring budget itself
  DELETE FROM public.budgets_recurring
  WHERE id = p_recurring_id;
END;
$function$;