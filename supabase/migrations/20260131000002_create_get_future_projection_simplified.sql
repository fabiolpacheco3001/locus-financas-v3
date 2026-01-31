-- ============================================
-- RPC: get_future_projection (Versão Simplificada)
-- Migra lógica de cálculo de projeção futura para PostgreSQL
-- Recebe apenas 2 parâmetros e calcula tudo internamente
-- ============================================

-- Remove função anterior se existir (com assinatura diferente)
DROP FUNCTION IF EXISTS public.get_future_projection(uuid, date, numeric, numeric, numeric, numeric);

CREATE OR REPLACE FUNCTION public.get_future_projection(
  p_household_id uuid,
  p_target_month date
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  v_user_household_id uuid;
  v_current_balance numeric := 0;
  v_pending_fixed_expenses numeric := 0;
  v_confirmed_variable_this_month numeric := 0;
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
  v_projected_balance numeric := 0;
  v_safety_buffer numeric := 0;
  v_safe_spending_zone numeric := 0;
  v_risk_level text;
  v_risk_percentage numeric := 0;
  v_is_high_risk boolean := false;
  v_is_data_sufficient boolean := false;
  v_confidence_level text;
  v_start_date date;
  v_end_date date;
  v_month_end date;
  v_diff_days integer;
  v_month_start date;
  v_month_end_date date;
  v_safety_buffer_percent numeric := 10;
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

  -- Calcula limites do mês selecionado
  v_month_start := date_trunc('month', p_target_month)::date;
  v_month_end_date := (date_trunc('month', p_target_month) + interval '1 month - 1 day')::date;

  -- 1. Calcula saldo disponível atual (soma de contas não-reserva e ativas)
  -- QUALIDADE: Usa current_balance que já está calculado pelo banco
  SELECT COALESCE(SUM(current_balance), 0)
  INTO v_current_balance
  FROM public.accounts
  WHERE household_id = p_household_id
    AND is_reserve = false
    AND is_active = true;

  -- 2. Calcula despesas fixas pendentes do mês selecionado
  -- QUALIDADE: Apenas expenses, apenas fixed, apenas planned, apenas do mês selecionado
  SELECT COALESCE(SUM(amount), 0)
  INTO v_pending_fixed_expenses
  FROM public.transactions
  WHERE household_id = p_household_id
    AND kind = 'EXPENSE'
    AND expense_type = 'fixed'
    AND status = 'planned'
    AND date >= v_month_start
    AND date <= v_month_end_date
    AND cancelled_at IS NULL;

  -- 3. Calcula despesas variáveis confirmadas do mês selecionado
  -- QUALIDADE: Apenas expenses, apenas variable, apenas confirmed, apenas do mês selecionado
  SELECT COALESCE(SUM(amount), 0)
  INTO v_confirmed_variable_this_month
  FROM public.transactions
  WHERE household_id = p_household_id
    AND kind = 'EXPENSE'
    AND expense_type = 'variable'
    AND status = 'confirmed'
    AND date >= v_month_start
    AND date <= v_month_end_date
    AND cancelled_at IS NULL;

  -- 4. Calcula intervalo de datas para histórico (últimos 3 meses completos, excluindo o mês selecionado)
  -- Exemplo: se target_month é 2026-01, busca de 2025-10 até 2025-12
  -- Último dia do mês anterior ao selecionado
  v_end_date := v_month_start - interval '1 day';
  -- Primeiro dia do primeiro dos 3 meses (3 meses antes do fim)
  v_start_date := (date_trunc('month', v_end_date) - interval '2 months')::date;

  -- 5. Calcula média histórica de despesas variáveis dos últimos 3 meses completos
  -- QUALIDADE: Ignora transações de receita (apenas EXPENSE), agrupa por mês
  -- PERFORMANCE: Usa índices em household_id e date
  WITH monthly_totals AS (
    SELECT 
      date_trunc('month', date)::date as month_start,
      SUM(amount) as monthly_total
    FROM public.transactions
    WHERE household_id = p_household_id
      AND kind = 'EXPENSE'  -- QUALIDADE: Ignora receitas
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

  -- 6. Busca orçamentos planejados para o mês selecionado
  SELECT COALESCE(SUM(planned_amount), 0)
  INTO v_planned_budget_variable
  FROM public.budgets
  WHERE household_id = p_household_id
    AND year = EXTRACT(YEAR FROM p_target_month)::integer
    AND month = EXTRACT(MONTH FROM p_target_month)::integer;

  -- 7. Calcula dias no mês, dias transcorridos e dias restantes
  v_days_in_month := EXTRACT(DAY FROM (date_trunc('month', p_target_month) + interval '1 month - 1 day'))::integer;
  
  -- Verifica se o mês selecionado é o mês atual
  IF date_trunc('month', p_target_month) = date_trunc('month', CURRENT_DATE) THEN
    -- Mês atual: calcula dias restantes usando diferença de datas (incluindo o dia atual)
    v_month_end := (date_trunc('month', p_target_month) + interval '1 month - 1 day')::date;
    v_diff_days := (v_month_end - CURRENT_DATE)::integer;
    v_days_remaining := GREATEST(0, v_diff_days + 1);
    
    -- daysElapsed = max(1, daysInMonth - daysRemaining + 1)
    v_days_elapsed := GREATEST(1, v_days_in_month - v_days_remaining + 1);
  ELSE
    -- Mês passado ou futuro: mostra projeção do mês completo
    v_days_elapsed := v_days_in_month;
    v_days_remaining := 0;
  END IF;

  -- 8. Determina se há dados históricos suficientes
  v_has_historical_data := v_historical_avg > 0;
  v_using_budget_fallback := NOT v_has_historical_data AND v_planned_budget_variable > 0;
  
  -- 9. Escolhe a fonte de dados: histórico ou orçamento planejado (fallback)
  v_effective_variable_avg := CASE 
    WHEN v_has_historical_data THEN v_historical_avg
    ELSE v_planned_budget_variable
  END;

  -- 10. Calcula taxa diária variável e projeção para dias restantes
  v_daily_variable_rate := CASE 
    WHEN v_days_in_month > 0 THEN v_effective_variable_avg / v_days_in_month
    ELSE 0
  END;
  
  v_projected_variable_remaining := v_daily_variable_rate * v_days_remaining;

  -- 11. Total de despesas projetadas
  v_total_projected_expenses := v_pending_fixed_expenses + v_projected_variable_remaining;

  -- 12. Saldo estimado ao final do mês (projectedBalance)
  v_estimated_end_of_month := v_current_balance - v_total_projected_expenses;
  v_projected_balance := v_estimated_end_of_month;

  -- 13. Calcula zona de gasto seguro (com margem de segurança)
  v_safety_buffer := ABS(v_current_balance) * (v_safety_buffer_percent / 100);
  v_safe_spending_zone := GREATEST(0, v_current_balance - v_pending_fixed_expenses - v_safety_buffer);

  -- 14. Determina nível de risco
  IF v_estimated_end_of_month >= v_safety_buffer THEN
    v_risk_level := 'safe';
    v_is_high_risk := false;
  ELSIF v_estimated_end_of_month >= 0 THEN
    v_risk_level := 'caution';
    v_is_high_risk := false;
  ELSE
    v_risk_level := 'danger';
    v_is_high_risk := true;
  END IF;

  -- 15. Calcula percentual de risco para barra de progresso
  IF v_current_balance <= 0 THEN
    v_risk_percentage := 0;
  ELSIF v_estimated_end_of_month >= v_current_balance THEN
    v_risk_percentage := 100;
  ELSIF v_estimated_end_of_month <= 0 THEN
    v_risk_percentage := GREATEST(0, ((v_current_balance + v_estimated_end_of_month) / v_current_balance) * 50);
  ELSE
    v_risk_percentage := 50 + (v_estimated_end_of_month / v_current_balance) * 50;
  END IF;
  
  v_risk_percentage := GREATEST(0, LEAST(100, v_risk_percentage));

  -- 16. Determina suficiência de dados
  v_is_data_sufficient := v_has_historical_data OR v_planned_budget_variable > 0;
  
  -- 17. Nível de confiança baseado na qualidade dos dados
  IF v_has_historical_data AND v_days_elapsed >= 7 THEN
    v_confidence_level := 'high';
  ELSIF v_has_historical_data OR (v_using_budget_fallback AND v_days_elapsed >= 3) THEN
    v_confidence_level := 'medium';
  ELSE
    v_confidence_level := 'low';
  END IF;

  -- 18. Constrói resultado JSON
  -- Inclui campos solicitados: projectedBalance, dailyVariableRate, isHighRisk
  -- E mantém compatibilidade com FutureEngineResult completo
  v_result := jsonb_build_object(
    -- Campos solicitados no requisito
    'projectedBalance', v_projected_balance,
    'dailyVariableRate', v_daily_variable_rate,
    'isHighRisk', v_is_high_risk,
    -- Campos para compatibilidade com FutureEngineResult
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
    'historicalMonthsCount', v_historical_months_count,
    -- Campos calculados internamente (para debug/transparência)
    'currentBalance', v_current_balance,
    'pendingFixedExpenses', v_pending_fixed_expenses,
    'confirmedVariableThisMonth', v_confirmed_variable_this_month
  );

  RETURN v_result;
END;
$$;

-- Concede permissão de execução para usuários autenticados
GRANT EXECUTE ON FUNCTION public.get_future_projection(uuid, date) TO authenticated;

-- Comentário de documentação
COMMENT ON FUNCTION public.get_future_projection IS 'Calcula projeção de saldo ao final do mês usando média histórica de despesas variáveis dos últimos 3 meses completos e orçamentos planejados. Retorna JSON com projectedBalance, dailyVariableRate, isHighRisk e campos completos do FutureEngineResult. Calcula internamente: currentBalance (contas não-reserva), pendingFixedExpenses e confirmedVariableThisMonth.';

-- Verifica se os índices necessários existem (já criados na migration inicial)
-- PERFORMANCE: Índices em household_id e date já existem:
-- - idx_transactions_household ON transactions(household_id)
-- - idx_transactions_date ON transactions(date)
-- - idx_accounts_household ON accounts(household_id)
-- - idx_budgets_household_period ON budgets(household_id, year, month)
