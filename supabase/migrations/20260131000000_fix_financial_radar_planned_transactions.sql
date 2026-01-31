-- ====================================================================
-- FIX: Financial Radar not showing amounts for 'planned' transactions
-- Problem: Transações com status 'planned' aparecem na lista mas estão 
--          com valor 0,00 nos indicadores do useFinancialRadar.ts
-- 
-- Root Cause:
-- 1. Comparação de datas sem casting explícito (due_date vs p_user_today)
-- 2. Falta de garantia de retorno quando não há dados correspondentes
-- 3. SUM pode retornar NULL mesmo com COALESCE quando aplicado sobre conjunto vazio
--
-- Solution:
-- 1. Usar due_date::date para garantir comparação correta apenas do dia
-- 2. Garantir retorno de estrutura válida mesmo sem dados
-- 3. Usar casting explícito para garantir tipos numéricos corretos
-- ====================================================================

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
  -- FIXED: Use due_date::date to ensure date-only comparison (ignores timezone)
  -- FIXED: Ensure numeric types are explicitly cast to prevent NULL issues
  SELECT jsonb_build_object(
    'overdue', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date::date < p_user_today THEN 1 ELSE 0 END), 0)::int,
      'amount', COALESCE(SUM(CASE WHEN due_date::date < p_user_today THEN amount ELSE 0 END), 0)::numeric
    ),
    'today', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date::date = p_user_today THEN 1 ELSE 0 END), 0)::int,
      'amount', COALESCE(SUM(CASE WHEN due_date::date = p_user_today THEN amount ELSE 0 END), 0)::numeric
    ),
    'upcoming', jsonb_build_object(
      'count', COALESCE(SUM(CASE WHEN due_date::date > p_user_today AND due_date::date <= (p_user_today + INTERVAL '7 days') THEN 1 ELSE 0 END), 0)::int,
      'amount', COALESCE(SUM(CASE WHEN due_date::date > p_user_today AND due_date::date <= (p_user_today + INTERVAL '7 days') THEN amount ELSE 0 END), 0)::numeric
    ),
    'reference_date', p_user_today::text
  ) INTO v_result
  FROM transactions
  WHERE household_id = p_household_id
    AND kind = 'EXPENSE'
    AND status = 'planned'
    AND cancelled_at IS NULL
    AND due_date IS NOT NULL;

  -- FIXED: Ensure we always return a valid structure, even when no data matches
  RETURN COALESCE(v_result, jsonb_build_object(
    'overdue', jsonb_build_object('count', 0, 'amount', 0),
    'today', jsonb_build_object('count', 0, 'amount', 0),
    'upcoming', jsonb_build_object('count', 0, 'amount', 0),
    'reference_date', p_user_today::text
  ));
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION public.get_financial_radar IS 
'Returns financial radar summary with overdue, today, and upcoming expense counts and amounts for the dashboard. 
Fixed to properly handle planned transactions by using explicit date casting (due_date::date) for accurate date-only comparisons.';
