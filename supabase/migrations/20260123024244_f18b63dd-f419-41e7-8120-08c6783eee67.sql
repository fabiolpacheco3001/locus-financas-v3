-- Drop and recreate the function with the new p_user_today parameter
DROP FUNCTION IF EXISTS public.get_financial_radar(uuid, date, date);

CREATE OR REPLACE FUNCTION public.get_financial_radar(
  p_household_id uuid,
  p_user_today date DEFAULT CURRENT_DATE,
  p_date_start date DEFAULT NULL,
  p_date_end date DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_user_household uuid;
BEGIN
  -- Security: Validate the user belongs to this household
  SELECT get_user_household_id() INTO v_user_household;
  
  IF v_user_household IS NULL OR v_user_household != p_household_id THEN
    RAISE EXCEPTION 'Access denied: user does not belong to household';
  END IF;

  -- Aggregate pending expenses into buckets based on user's local date
  SELECT jsonb_build_object(
    'overdue', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date < p_user_today THEN 1 ELSE 0 END), 0),
      'amount', COALESCE(SUM(CASE WHEN due_date < p_user_today THEN amount ELSE 0 END), 0)
    ),
    'today', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date = p_user_today THEN 1 ELSE 0 END), 0),
      'amount', COALESCE(SUM(CASE WHEN due_date = p_user_today THEN amount ELSE 0 END), 0)
    ),
    'upcoming', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date > p_user_today AND due_date <= (p_user_today + INTERVAL '7 days') THEN 1 ELSE 0 END), 0),
      'amount', COALESCE(SUM(CASE WHEN due_date > p_user_today AND due_date <= (p_user_today + INTERVAL '7 days') THEN amount ELSE 0 END), 0)
    ),
    'reference_date', p_user_today::text
  ) INTO v_result
  FROM transactions
  WHERE household_id = p_household_id
    AND kind = 'EXPENSE'
    AND status = 'planned'
    AND cancelled_at IS NULL
    AND due_date IS NOT NULL;

  RETURN v_result;
END;
$$;