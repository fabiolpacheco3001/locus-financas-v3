-- Create RPC function for financial radar dashboard
-- Returns summary of overdue, today, and upcoming expenses in a single query

CREATE OR REPLACE FUNCTION public.get_financial_radar(
  p_household_id uuid,
  p_date_start date DEFAULT CURRENT_DATE - INTERVAL '30 days',
  p_date_end date DEFAULT CURRENT_DATE + INTERVAL '7 days'
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb;
  v_today date := CURRENT_DATE;
BEGIN
  -- Security check: verify user belongs to the requested household
  IF p_household_id != get_user_household_id() THEN
    RAISE EXCEPTION 'Access denied: user does not belong to this household';
  END IF;

  SELECT jsonb_build_object(
    'overdue', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date < v_today THEN 1 ELSE 0 END), 0)::int,
      'amount', COALESCE(SUM(CASE WHEN due_date < v_today THEN amount ELSE 0 END), 0)::numeric
    ),
    'today', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date = v_today THEN 1 ELSE 0 END), 0)::int,
      'amount', COALESCE(SUM(CASE WHEN due_date = v_today THEN amount ELSE 0 END), 0)::numeric
    ),
    'upcoming', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date > v_today AND due_date <= v_today + INTERVAL '7 days' THEN 1 ELSE 0 END), 0)::int,
      'amount', COALESCE(SUM(CASE WHEN due_date > v_today AND due_date <= v_today + INTERVAL '7 days' THEN amount ELSE 0 END), 0)::numeric
    ),
    'reference_date', v_today
  )
  INTO v_result
  FROM transactions
  WHERE household_id = p_household_id
    AND kind = 'EXPENSE'
    AND status = 'planned'
    AND cancelled_at IS NULL
    AND due_date IS NOT NULL
    AND due_date >= p_date_start
    AND due_date <= p_date_end;

  -- Return empty structure if no data found
  RETURN COALESCE(v_result, jsonb_build_object(
    'overdue', jsonb_build_object('count', 0, 'amount', 0),
    'today', jsonb_build_object('count', 0, 'amount', 0),
    'upcoming', jsonb_build_object('count', 0, 'amount', 0),
    'reference_date', v_today
  ));
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_financial_radar IS 'Returns financial radar summary with overdue, today, and upcoming expense counts and amounts for the dashboard';