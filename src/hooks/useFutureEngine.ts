/**
 * useFutureEngine - Hook para projeção de saldo ao final do mês
 * 
 * Usa RPC do PostgreSQL para calcular projeções diretamente no banco de dados.
 * Reduz payload de centenas de transações para 1 único objeto JSON.
 */

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { format } from 'date-fns';
import type { FutureEngineResult } from '@/domain/finance/computeFutureEngine';
import { computeFutureEngine } from '@/domain/finance/computeFutureEngine';
import { getDaysInMonth } from 'date-fns';

// ============================================
// TIPOS
// ============================================

export interface UseFutureEngineOptions {
  /** Mês atualmente selecionado */
  selectedMonth: Date;
  
  /** @deprecated Não é mais necessário - calculado internamente pela RPC */
  currentBalance?: number;
  
  /** @deprecated Não é mais necessário - calculado internamente pela RPC */
  pendingFixedExpenses?: number;
  
  /** @deprecated Não é mais necessário - calculado internamente pela RPC */
  confirmedVariableThisMonth?: number;
}

export interface UseFutureEngineResult extends FutureEngineResult {
  /** Se os dados ainda estão carregando */
  isLoading: boolean;
  
  /** Média histórica de despesas variáveis (3 meses) */
  historicalVariableAvg: number;
  
  /** Número de meses históricos com dados */
  historicalMonthsCount: number;
}

/**
 * Tipo de retorno da RPC get_future_projection
 */
interface RPCFutureProjectionResult extends FutureEngineResult {
  historicalVariableAvg: number;
  historicalMonthsCount: number;
}

// ============================================
// HOOK
// ============================================

/**
 * Hook para calcular projeção de saldo ao final do mês
 * 
 * Usa RPC do PostgreSQL para calcular projeções diretamente no banco:
 * - Calcula internamente: currentBalance, pendingFixedExpenses, confirmedVariableThisMonth
 * - Média histórica de despesas variáveis dos últimos 3 meses completos
 * - Fallback para orçamento planejado quando não há histórico
 * - Cálculo de dias restantes e projeção de gastos
 * 
 * Reduz payload de centenas de transações para 1 único objeto JSON.
 * 
 * @param options - Opções de configuração do hook (apenas selectedMonth necessário)
 * @returns Resultado da projeção com dados históricos e status de carregamento
 */
export function useFutureEngine(options: UseFutureEngineOptions): UseFutureEngineResult {
  const { selectedMonth } = options;
  const { householdId } = useAuth();

  // Formata data do mês selecionado para DATE (YYYY-MM-DD)
  const selectedMonthDate = format(selectedMonth, 'yyyy-MM-dd');

  // Chama RPC para calcular projeção diretamente no banco
  // A RPC calcula tudo internamente: currentBalance, pendingFixedExpenses, confirmedVariableThisMonth
  const { data: rpcData, isLoading } = useQuery({
    queryKey: [
      'future-engine-projection',
      householdId,
      selectedMonthDate,
    ],
    queryFn: async (): Promise<any | null> => {
      if (!householdId) {
        return null;
      }

      const { data, error } = await supabase.rpc('get_future_projection', {
        p_household_id: householdId,
        p_target_month: selectedMonthDate,
      });

      if (error) {
        console.error('Erro ao calcular projeção futura:', error);
        return null;
      }

      // A RPC retorna um JSONB com os dados calculados
      return data;
    },
    enabled: !!householdId,
    staleTime: 5 * 60 * 1000, // 5 minutos
  });

  // Processa os dados da RPC usando computeFutureEngine dentro de useMemo
  const projection = useMemo(() => {
    if (!rpcData) {
      return null;
    }

    // Extrai dados necessários da RPC para chamar computeFutureEngine
    const daysInMonth = getDaysInMonth(selectedMonth);
    const daysElapsed = daysInMonth - (rpcData.daysRemaining || 0);
    
    // Prepara dados para computeFutureEngine
    // A RPC já calcula tudo, mas chamamos computeFutureEngine para garantir formato correto
    const rpcInput = {
      currentBalance: rpcData.currentBalance ?? 0,
      pendingFixedExpenses: rpcData.pendingFixedExpenses ?? 0,
      confirmedVariableThisMonth: rpcData.confirmedVariableThisMonth ?? 0,
      historicalVariableAvg: rpcData.historicalVariableAvg ?? 0,
      daysElapsed: Math.max(1, daysElapsed),
      daysInMonth,
      // A RPC já usa plannedBudgetVariable internamente, mas não retorna no JSONB
      // Usamos 0 aqui porque a RPC já considerou isso no cálculo de effectiveVariableAvg
      plannedBudgetVariable: 0,
    };
    
    // Chama computeFutureEngine com os dados da RPC
    const computedResult = computeFutureEngine(rpcInput);

    // Retorna resultado combinando dados da RPC com resultado computado
    // Garante que todos os campos de UseFutureEngineResult estejam presentes
    return {
      ...computedResult,
      historicalVariableAvg: rpcData.historicalVariableAvg ?? 0,
      historicalMonthsCount: rpcData.historicalMonthsCount ?? 0,
      // Garante que riskLevel e confidenceLevel estejam presentes (sempre retornados por computeFutureEngine)
      riskLevel: computedResult.riskLevel,
      confidenceLevel: computedResult.confidenceLevel,
    } as RPCFutureProjectionResult;
  }, [rpcData, selectedMonth]);

  // Retorna resultado padrão enquanto carrega ou se não houver dados
  const defaultResult: UseFutureEngineResult = {
    estimatedEndOfMonth: 0,
    safeSpendingZone: 0,
    riskLevel: 'safe',
    riskPercentage: 0,
    projectedVariableRemaining: 0,
    totalProjectedExpenses: 0,
    daysRemaining: 0,
    isDataSufficient: false,
    confidenceLevel: 'low',
    usingBudgetFallback: false,
    isLoading: isLoading,
    historicalVariableAvg: 0,
    historicalMonthsCount: 0,
  };

  if (!projection) {
    return defaultResult;
  }

  return {
    ...projection,
    isLoading,
  };
}
