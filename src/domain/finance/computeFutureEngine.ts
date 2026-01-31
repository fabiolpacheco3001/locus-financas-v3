/**
 * computeFutureEngine - Função pura para projeção de saldo ao final do mês
 * 
 * Fórmula: estimatedEndOfMonth = currentBalance - pendingFixedExpenses - estimatedVariableSpending
 * 
 * SEM efeitos colaterais, SEM dependências React - esta é uma função pura de domínio.
 */

import { getDaysInMonth, endOfMonth } from 'date-fns';
import { parseDateOnly, formatLocalDateOnly } from '@/lib/dateOnly';

// ============================================
// TIPOS DE ENTRADA/SAÍDA
// ============================================

/**
 * Interface para transação histórica utilizada no cálculo de média
 */
export interface HistoricalTransaction {
  /** Data da transação no formato YYYY-MM-DD */
  date: string;
  /** Valor da transação */
  amount: number;
}

/**
 * Parâmetros de entrada para o cálculo de projeção financeira
 */
export interface FutureEngineInput {
  /** Saldo atual disponível (exclui reservas) */
  currentBalance: number;
  
  /** Despesas fixas com status='planned' para este mês */
  pendingFixedExpenses: number;
  
  /** Despesas variáveis já confirmadas neste mês */
  confirmedVariableThisMonth: number;
  
  /** Média histórica de despesas variáveis mensais (últimos 3 meses) */
  historicalVariableAvg: number;
  
  /** Número de dias transcorridos no mês atual */
  daysElapsed: number;
  
  /** Total de dias no mês atual */
  daysInMonth: number;
  
  /** Percentual opcional de margem de segurança (padrão: 10%) */
  safetyBufferPercent?: number;
  
  /** Valor planejado de orçamento para despesas variáveis (fallback quando não há histórico) */
  plannedBudgetVariable: number;
}

/**
 * Resultado da projeção financeira
 */
export interface FutureEngineResult {
  // Projeções principais
  /** Saldo estimado ao final do mês */
  estimatedEndOfMonth: number;
  
  /** Valor disponível para gastar com segurança (com margem de segurança) */
  safeSpendingZone: number;
  
  // Indicadores de risco
  /** Classificação de risco baseada no saldo projetado */
  riskLevel: 'safe' | 'caution' | 'danger';
  
  /** Percentual para barra de progresso (0-100, limitado) */
  riskPercentage: number;
  
  // Detalhes do breakdown
  /** Projeção de gastos variáveis restantes para o mês */
  projectedVariableRemaining: number;
  
  /** Total de despesas projetadas (fixas pendentes + variáveis projetadas) */
  totalProjectedExpenses: number;
  
  /** Dias restantes no mês */
  daysRemaining: number;
  
  // Metadados
  /** Se há dados históricos suficientes para projeção confiável */
  isDataSufficient: boolean;
  
  /** Nível de confiança da projeção */
  confidenceLevel: 'high' | 'medium' | 'low';
  
  /** Se está usando fallback de orçamento planejado */
  usingBudgetFallback: boolean;
}

/**
 * Resultado do cálculo de média histórica
 */
export interface HistoricalAverageResult {
  /** Média mensal calculada */
  average: number;
  
  /** Número de meses com dados históricos */
  monthsCount: number;
  
  /** Total de despesas variáveis nos meses analisados */
  totalAmount: number;
}

// ============================================
// FUNÇÕES AUXILIARES
// ============================================

/**
 * Calcula os dias restantes no mês usando dateOnly para evitar problemas de fuso horário
 * 
 * Usa dateOnly para garantir que anos bissextos e fusos horários sejam tratados corretamente.
 * 
 * @param selectedMonth - Mês selecionado para cálculo
 * @param referenceDate - Data de referência (padrão: hoje)
 * @returns Número de dias restantes no mês (incluindo o dia de referência)
 */
export function calculateDaysRemaining(selectedMonth: Date, referenceDate: Date = new Date()): number {
  // Usa dateOnly para evitar problemas de fuso horário
  const referenceDateOnly = formatLocalDateOnly(referenceDate);
  const parsedReference = parseDateOnly(referenceDateOnly);
  
  const monthEnd = endOfMonth(selectedMonth);
  const monthEndOnly = formatLocalDateOnly(monthEnd);
  const parsedMonthEnd = parseDateOnly(monthEndOnly);
  
  // Calcula diferença em dias usando datas locais (sem fuso horário)
  // Usa getTime() para calcular diferença em milissegundos e converter para dias
  const referenceTime = parsedReference.getTime();
  const monthEndTime = parsedMonthEnd.getTime();
  
  // Diferença em milissegundos convertida para dias
  const diffMs = monthEndTime - referenceTime;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  
  // Retorna pelo menos 0, e inclui o dia de referência (+1)
  return Math.max(0, diffDays + 1);
}

/**
 * Calcula os dias transcorridos no mês usando dateOnly para evitar problemas de fuso horário
 * 
 * @param selectedMonth - Mês selecionado para cálculo
 * @param referenceDate - Data de referência (padrão: hoje)
 * @returns Número de dias transcorridos no mês (mínimo 1)
 */
export function calculateDaysElapsed(selectedMonth: Date, referenceDate: Date = new Date()): number {
  const daysInMonth = getDaysInMonth(selectedMonth);
  const daysRemaining = calculateDaysRemaining(selectedMonth, referenceDate);
  
  // Garante que pelo menos 1 dia foi transcorrido
  return Math.max(1, daysInMonth - daysRemaining + 1);
}

/**
 * Calcula a média histórica de despesas variáveis dos últimos 3 meses
 * 
 * Esta é uma função pura que agrupa transações por mês e calcula a média mensal.
 * 
 * @param transactions - Array de transações históricas
 * @returns Resultado com média, número de meses e total
 */
export function calculateHistoricalAverage(
  transactions: HistoricalTransaction[]
): HistoricalAverageResult {
  if (!transactions || transactions.length === 0) {
    return {
      average: 0,
      monthsCount: 0,
      totalAmount: 0,
    };
  }

  // Agrupa por mês (YYYY-MM)
  const monthlyTotals: Record<string, number> = {};
  
  transactions.forEach((tx) => {
    // Extrai YYYY-MM da data (primeiros 7 caracteres)
    const monthKey = tx.date.substring(0, 7);
    if (!monthlyTotals[monthKey]) {
      monthlyTotals[monthKey] = 0;
    }
    monthlyTotals[monthKey] += Number(tx.amount);
  });

  const months = Object.keys(monthlyTotals);
  const totalAmount = Object.values(monthlyTotals).reduce((sum, val) => sum + val, 0);
  const average = months.length > 0 ? totalAmount / months.length : 0;

  return {
    average,
    monthsCount: months.length,
    totalAmount,
  };
}

// ============================================
// FUNÇÃO PRINCIPAL
// ============================================

/**
 * Calcula a projeção de saldo ao final do mês
 * 
 * Usa um modelo de taxa diária para despesas variáveis:
 * - Calcula taxa diária variável a partir da média histórica
 * - Projeta gastos variáveis restantes baseado nos dias restantes
 * - Subtrai despesas fixas pendentes e variáveis projetadas do saldo atual
 * 
 * Se não houver histórico suficiente, usa o orçamento planejado como fallback.
 * 
 * @param input - Parâmetros de entrada para o cálculo
 * @returns Resultado da projeção financeira
 */
export function computeFutureEngine(input: FutureEngineInput): FutureEngineResult {
  const {
    currentBalance,
    pendingFixedExpenses,
    confirmedVariableThisMonth,
    historicalVariableAvg,
    daysElapsed,
    daysInMonth,
    safetyBufferPercent = 10,
    plannedBudgetVariable,
  } = input;

  // Calcula dias restantes
  const daysRemaining = Math.max(0, daysInMonth - daysElapsed);

  // Determina se há dados históricos suficientes
  const hasHistoricalData = historicalVariableAvg > 0;
  const usingBudgetFallback = !hasHistoricalData && plannedBudgetVariable > 0;
  
  // Escolhe a fonte de dados: histórico ou orçamento planejado (fallback)
  const effectiveVariableAvg = hasHistoricalData 
    ? historicalVariableAvg 
    : plannedBudgetVariable;

  // Calcula projeção de gastos variáveis para os dias restantes
  // Usando taxa diária histórica: (média / dias no mês) * dias restantes
  const dailyVariableRate = daysInMonth > 0 ? effectiveVariableAvg / daysInMonth : 0;
  const projectedVariableRemaining = dailyVariableRate * daysRemaining;

  // Total de despesas projetadas
  const totalProjectedExpenses = pendingFixedExpenses + projectedVariableRemaining;

  // Saldo estimado ao final do mês
  const estimatedEndOfMonth = currentBalance - totalProjectedExpenses;

  // Calcula zona de gasto seguro (com margem de segurança)
  const safetyBuffer = Math.abs(currentBalance) * (safetyBufferPercent / 100);
  const safeSpendingZone = Math.max(0, currentBalance - pendingFixedExpenses - safetyBuffer);

  // Determina nível de risco
  let riskLevel: 'safe' | 'caution' | 'danger';
  if (estimatedEndOfMonth >= safetyBuffer) {
    riskLevel = 'safe';
  } else if (estimatedEndOfMonth >= 0) {
    riskLevel = 'caution';
  } else {
    riskLevel = 'danger';
  }

  // Calcula percentual de risco para barra de progresso
  // 100% = totalmente seguro, 0% = saldo zero ou negativo
  let riskPercentage: number;
  if (currentBalance <= 0) {
    riskPercentage = 0;
  } else if (estimatedEndOfMonth >= currentBalance) {
    riskPercentage = 100;
  } else if (estimatedEndOfMonth <= 0) {
    riskPercentage = Math.max(0, ((currentBalance + estimatedEndOfMonth) / currentBalance) * 50);
  } else {
    riskPercentage = 50 + (estimatedEndOfMonth / currentBalance) * 50;
  }
  riskPercentage = Math.max(0, Math.min(100, riskPercentage));

  // Determina suficiência de dados: true se houver histórico OU se houver orçamento planejado
  const isDataSufficient = hasHistoricalData || plannedBudgetVariable > 0;
  
  // Nível de confiança baseado na qualidade dos dados
  let confidenceLevel: 'high' | 'medium' | 'low';
  if (hasHistoricalData && daysElapsed >= 7) {
    confidenceLevel = 'high';
  } else if (hasHistoricalData || (usingBudgetFallback && daysElapsed >= 3)) {
    confidenceLevel = 'medium';
  } else {
    confidenceLevel = 'low';
  }

  return {
    estimatedEndOfMonth,
    safeSpendingZone,
    riskLevel,
    riskPercentage,
    projectedVariableRemaining,
    totalProjectedExpenses,
    daysRemaining,
    isDataSufficient,
    confidenceLevel,
    usingBudgetFallback,
  };
}
