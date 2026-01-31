/**
 * useFutureEngine - Hook para projeção de saldo ao final do mês
 * 
 * Busca dados históricos, calcula projeções e retorna resultados memoizados.
 * Inclui fallback para orçamento planejado quando não há histórico suficiente.
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { 
  computeFutureEngine, 
  calculateDaysElapsed,
  calculateDaysRemaining,
  calculateHistoricalAverage,
  type FutureEngineResult,
  type HistoricalTransaction,
} from '@/domain/finance/computeFutureEngine';
import { 
  startOfMonth, 
  subMonths, 
  endOfMonth, 
  getDaysInMonth, 
  format,
  isSameMonth
} from 'date-fns';

// ============================================
// TIPOS
// ============================================

export interface UseFutureEngineOptions {
  /** Mês atualmente selecionado */
  selectedMonth: Date;
  
  /** Saldo disponível atual (de useAccountProjections) */
  currentBalance: number;
  
  /** Despesas fixas pendentes para o mês */
  pendingFixedExpenses: number;
  
  /** Despesas variáveis confirmadas neste mês */
  confirmedVariableThisMonth: number;
}

export interface UseFutureEngineResult extends FutureEngineResult {
  /** Se os dados ainda estão carregando */
  isLoading: boolean;
  
  /** Média histórica de despesas variáveis (3 meses) */
  historicalVariableAvg: number;
  
  /** Número de meses históricos com dados */
  historicalMonthsCount: number;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook para calcular projeção de saldo ao final do mês
 * 
 * Busca dados históricos dos últimos 3 meses e calcula projeções usando:
 * - Média histórica de despesas variáveis
 * - Fallback para orçamento planejado quando não há histórico
 * - Cálculo preciso de dias restantes usando dateOnly
 * 
 * @param options - Opções de configuração do hook
 * @returns Resultado da projeção com dados históricos e status de carregamento
 */
export function useFutureEngine(options: UseFutureEngineOptions): UseFutureEngineResult {
  const { selectedMonth, currentBalance, pendingFixedExpenses, confirmedVariableThisMonth } = options;
  const { householdId } = useAuth();

  // Calcula intervalo de datas para query histórica (últimos 3 meses, excluindo atual)
  const historicalRange = useMemo(() => {
    const endDate = endOfMonth(subMonths(selectedMonth, 1));
    const startDate = startOfMonth(subMonths(selectedMonth, 3));
    return {
      start: format(startDate, 'yyyy-MM-dd'),
      end: format(endDate, 'yyyy-MM-dd'),
    };
  }, [selectedMonth]);

  // Busca despesas variáveis históricas (últimos 3 meses)
  const { data: historicalData, isLoading: isLoadingHistory } = useQuery({
    queryKey: ['future-engine-history', householdId, historicalRange.start, historicalRange.end],
    queryFn: async (): Promise<HistoricalTransaction[]> => {
      if (!householdId) {
        return [];
      }

      const { data, error } = await supabase
        .from('transactions')
        .select('amount, date')
        .eq('household_id', householdId)
        .eq('kind', 'EXPENSE')
        .eq('status', 'confirmed')
        .eq('expense_type', 'variable')
        .gte('date', historicalRange.start)
        .lte('date', historicalRange.end)
        .is('cancelled_at', null);

      if (error) {
        console.error('Erro ao buscar dados históricos:', error);
        return [];
      }

      // Converte para formato esperado pela função de domínio
      return (data || []).map((tx) => ({
        date: tx.date,
        amount: Number(tx.amount),
      }));
    },
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Calcula ano e mês para buscar orçamento planejado
  const budgetYear = selectedMonth.getFullYear();
  const budgetMonth = selectedMonth.getMonth() + 1;

  // Busca orçamento planejado para o mês (fallback quando não há histórico)
  const { data: budgets = [], isLoading: isLoadingBudgets } = useQuery({
    queryKey: ['future-engine-budgets', householdId, budgetYear, budgetMonth],
    queryFn: async () => {
      if (!householdId) {
        return [];
      }

      const { data, error } = await supabase
        .from('budgets')
        .select('planned_amount')
        .eq('household_id', householdId)
        .eq('year', budgetYear)
        .eq('month', budgetMonth);

      if (error) {
        console.error('Erro ao buscar orçamentos:', error);
        return [];
      }

      return data || [];
    },
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Calcula total de orçamento planejado (soma de todos os budgets)
  // Nota: Idealmente deveria filtrar apenas budgets de despesas variáveis,
  // mas como não há essa informação direta, usamos o total como fallback
  const plannedBudgetVariable = useMemo(() => {
    return budgets.reduce((sum, budget) => sum + Number(budget.planned_amount), 0);
  }, [budgets]);

  // Calcula média histórica usando função pura do domínio
  const { average: historicalVariableAvg, monthsCount: historicalMonthsCount } = useMemo(() => {
    return calculateHistoricalAverage(historicalData || []);
  }, [historicalData]);

  // Calcula entradas baseadas em tempo
  const { daysElapsed, daysInMonth, daysRemaining } = useMemo(() => {
    const today = new Date();
    const isCurrentMonth = isSameMonth(selectedMonth, today);
    
    const totalDays = getDaysInMonth(selectedMonth);
    
    if (!isCurrentMonth) {
      // Para meses passados/futuros, mostra projeção do mês completo
      return {
        daysElapsed: totalDays,
        daysInMonth: totalDays,
        daysRemaining: 0,
      };
    }

    return {
      daysElapsed: calculateDaysElapsed(selectedMonth, today),
      daysInMonth: totalDays,
      daysRemaining: calculateDaysRemaining(selectedMonth, today),
    };
  }, [selectedMonth]);

  // Calcula projeção do future engine
  const projection = useMemo(() => {
    return computeFutureEngine({
      currentBalance,
      pendingFixedExpenses,
      confirmedVariableThisMonth,
      historicalVariableAvg,
      daysElapsed,
      daysInMonth,
      plannedBudgetVariable,
    });
  }, [
    currentBalance,
    pendingFixedExpenses,
    confirmedVariableThisMonth,
    historicalVariableAvg,
    daysElapsed,
    daysInMonth,
    plannedBudgetVariable,
  ]);

  const isLoading = isLoadingHistory || isLoadingBudgets;

  return {
    ...projection,
    isLoading,
    historicalVariableAvg,
    historicalMonthsCount,
    daysRemaining,
  };
}
