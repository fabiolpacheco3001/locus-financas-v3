-- ============================================
-- RPC: get_future_projection
-- Migra lógica de cálculo de projeção futura para PostgreSQL
-- ============================================

CREATE OR REPLACE FUNCTION public.get_future_projection(
  p_household_id uuid,
  p_selected_month date,
  p_current_balance numeric,
  p_pending_fixed_expenses numeric,
  p_confirmed_variable_this_month numeric,
  p_safety_buffer_percent numeric DEFAULT 10
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_household_id uuid;
  v_historical_avg numeric := 0;
  v_historical_months_count integer := 0;
  v_planned_budget_variable numeric := 0;
  v_days_in_month integer;
  v_days_elapsed integer;
  v_days_remaining integer;
  v_has_historical_data boolean := false;
  v_using_budget_fallback boolean := false;
  v_effective_variable_avg numeric := 0;
  v_daily_variable_rate numeric := 0;
  v_projected_variable_remaining numeric := 0;
  v_total_projected_expenses numeric := 0;
  v_estimated_end_of_month numeric := 0;
  v_safety_buffer numeric := 0;
  v_safe_spending_zone numeric := 0;
  v_risk_level text;
  v_risk_percentage numeric := 0;
  v_is_data_sufficient boolean := false;
  v_confidence_level text;
  v_start_date date;
  v_end_date date;
  v_month_end date;
  v_diff_days integer;
  v_result jsonb;
BEGIN
  -- Validação de segurança: verificar que o usuário pertence ao household_id fornecido
  v_user_household_id := public.get_user_household_id();
  
  IF v_user_household_id IS NULL THEN
    RAISE EXCEPTION 'User not authenticated';
  END IF;
  
  IF v_user_household_id <> p_household_id THEN
    RAISE EXCEPTION 'Access denied: household_id does not belong to your household';
  END IF;

  -- Calcula intervalo de datas para histórico (últimos 3 meses, excluindo o mês selecionado)
  -- Exemplo: se selected_month é 2026-01, busca de 2025-10 até 2025-12
  v_end_date := date_trunc('month', p_selected_month) - interval '1 day';
  v_start_date := date_trunc('month', p_selected_month) - interval '3 months';

  -- Calcula média histórica de despesas variáveis dos últimos 3 meses
  -- Agrupa por mês (YYYY-MM) e calcula média mensal
  WITH monthly_totals AS (
    SELECT 
      date_trunc('month', date)::date as month_start,
      SUM(amount) as monthly_total
    FROM public.transactions
    WHERE household_id = p_household_id
      AND kind = 'EXPENSE'
      AND status = 'confirmed'
      AND expense_type = 'variable'
      AND date >= v_start_date
      AND date <= v_end_date
      AND cancelled_at IS NULL
    GROUP BY date_trunc('month', date)::date
  )
  SELECT 
    COALESCE(AVG(monthly_total), 0),
    COUNT(DISTINCT month_start)
  INTO v_historical_avg, v_historical_months_count
  FROM monthly_totals;

  -- Busca orçamentos planejados para o mês selecionado
  SELECT COALESCE(SUM(planned_amount), 0)
  INTO v_planned_budget_variable
  FROM public.budgets
  WHERE household_id = p_household_id
    AND year = EXTRACT(YEAR FROM p_selected_month)::integer
    AND month = EXTRACT(MONTH FROM p_selected_month)::integer;

  -- Calcula dias no mês, dias transcorridos e dias restantes
  -- Usa a mesma lógica do código TypeScript (calculateDaysRemaining e calculateDaysElapsed)
  v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', p_selected_month) + interval '1 month - 1 day'))::integer;
  
  -- Verifica se o mês selecionado é o mês atual
  IF date_trunc('month', p_selected_month) = date_trunc('month', CURRENT_DATE) THEN
    -- Mês atual: calcula dias restantes usando diferença de datas (incluindo o dia atual)
    -- daysRemaining = max(0, (monthEnd - referenceDate) + 1)
    v_month_end := (date_trunc('month', p_selected_month) + interval '1 month - 1 day')::date;
    v_diff_days := (v_month_end - CURRENT_DATE)::integer;
    v_days_remaining := GREATEST(0, v_diff_days + 1);
    
    -- daysElapsed = max(1, daysInMonth - daysRemaining + 1)
    v_days_elapsed := GREATEST(1, v_days_in_month - v_days_remaining + 1);
  ELSE
    -- Mês passado ou futuro: mostra projeção do mês completo
    v_days_elapsed := v_days_in_month;
    v_days_remaining := 0;
  END IF;

  -- Determina se há dados históricos suficientes
  v_has_historical_data := v_historical_avg > 0;
  v_using_budget_fallback := NOT v_has_historical_data AND v_planned_budget_variable > 0;
  
  -- Escolhe a fonte de dados: histórico ou orçamento planejado (fallback)
  v_effective_variable_avg := CASE 
    WHEN v_has_historical_data THEN v_historical_avg
    ELSE v_planned_budget_variable
  END;

  -- Calcula taxa diária variável e projeção para dias restantes
  v_daily_variable_rate := CASE 
    WHEN v_days_in_month > 0 THEN v_effective_variable_avg / v_days_in_month
    ELSE 0
  END;
  
  v_projected_variable_remaining := v_daily_variable_rate * v_days_remaining;

  -- Total de despesas projetadas
  v_total_projected_expenses := p_pending_fixed_expenses + v_projected_variable_remaining;

  -- Saldo estimado ao final do mês
  v_estimated_end_of_month := p_current_balance - v_total_projected_expenses;

  -- Calcula zona de gasto seguro (com margem de segurança)
  v_safety_buffer := ABS(p_current_balance) * (p_safety_buffer_percent / 100);
  v_safe_spending_zone := GREATEST(0, p_current_balance - p_pending_fixed_expenses - v_safety_buffer);

  -- Determina nível de risco
  IF v_estimated_end_of_month >= v_safety_buffer THEN
    v_risk_level := 'safe';
  ELSIF v_estimated_end_of_month >= 0 THEN
    v_risk_level := 'caution';
  ELSE
    v_risk_level := 'danger';
  END IF;

  -- Calcula percentual de risco para barra de progresso
  IF p_current_balance <= 0 THEN
    v_risk_percentage := 0;
  ELSIF v_estimated_end_of_month >= p_current_balance THEN
    v_risk_percentage := 100;
  ELSIF v_estimated_end_of_month <= 0 THEN
    v_risk_percentage := GREATEST(0, ((p_current_balance + v_estimated_end_of_month) / p_current_balance) * 50);
  ELSE
    v_risk_percentage := 50 + (v_estimated_end_of_month / p_current_balance) * 50;
  END IF;
  
  v_risk_percentage := GREATEST(0, LEAST(100, v_risk_percentage));

  -- Determina suficiência de dados
  v_is_data_sufficient := v_has_historical_data OR v_planned_budget_variable > 0;
  
  -- Nível de confiança baseado na qualidade dos dados
  IF v_has_historical_data AND v_days_elapsed >= 7 THEN
    v_confidence_level := 'high';
  ELSIF v_has_historical_data OR (v_using_budget_fallback AND v_days_elapsed >= 3) THEN
    v_confidence_level := 'medium';
  ELSE
    v_confidence_level := 'low';
  END IF;

  -- Constrói resultado JSON compatível com FutureEngineResult
  v_result := jsonb_build_object(
    'estimatedEndOfMonth', v_estimated_end_of_month,
    'safeSpendingZone', v_safe_spending_zone,
    'riskLevel', v_risk_level,
    'riskPercentage', v_risk_percentage,
    'projectedVariableRemaining', v_projected_variable_remaining,
    'totalProjectedExpenses', v_total_projected_expenses,
    'daysRemaining', v_days_remaining,
    'isDataSufficient', v_is_data_sufficient,
    'confidenceLevel', v_confidence_level,
    'usingBudgetFallback', v_using_budget_fallback,
    -- Campos adicionais para compatibilidade com UseFutureEngineResult
    'historicalVariableAvg', v_historical_avg,
    'historicalMonthsCount', v_historical_months_count
  );

  RETURN v_result;
END;
$$;

-- Concede permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_future_projection(uuid, date, numeric, numeric, numeric, numeric) TO authenticated;

-- Comentário de documentação
COMMENT ON FUNCTION public.get_future_projection IS 'Calcula projeção de saldo ao final do mês usando média histórica de despesas variáveis dos últimos 3 meses e orçamentos planejados. Retorna JSON compatível com FutureEngineResult.';
