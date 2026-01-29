import { useState, useMemo, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Transaction, Account, Budget, Category } from '@/types/finance';
import { 
  motorRisco, 
  RiskEngineOutput, 
  updateSimulatedTransaction,
  simulateInstallments,
  removeSimulatedTransaction
} from '@/lib/riskEngine';
import { LOCALE_CONFIG, SupportedLocale } from '@/i18n';

export type SimulationType = 'postponement' | 'installment' | 'deletion' | null;

export interface SimulationState {
  isActive: boolean;
  type: SimulationType;
  originalTransaction: Transaction | null;
  // Postponement specific
  simulatedDueDate: string | null;
  // Installment specific
  installmentCount: number | null;
  // UI
  description: string;
}

export interface SimulationComparison {
  beforeBalance: number;
  afterBalance: number;
  difference: number;
  isImprovement: boolean;
  // Detailed breakdown for clearer display
  beforePendingExpenses: number;
  afterPendingExpenses: number;
  expensesDifference: number;
}

export interface UseSimulationOptions {
  accounts: Account[];
  transactionsBase: Transaction[];
  budgets?: Budget[];
  categories?: Category[];
  selectedMonth: Date;
}

export interface UseSimulationReturn {
  simulation: SimulationState;
  simulatedTransactions: Transaction[];
  riskResult: RiskEngineOutput | null;
  riskResultBefore: RiskEngineOutput | null;
  comparison: SimulationComparison | null;
  startPostponementSimulation: (transaction: Transaction, newDueDate: string) => void;
  startInstallmentSimulation: (transaction: Transaction, installmentCount: number) => void;
  startDeletionSimulation: (transaction: Transaction) => void;
  clearSimulation: () => void;
  isSimulating: boolean;
}

const initialState: SimulationState = {
  isActive: false,
  type: null,
  originalTransaction: null,
  simulatedDueDate: null,
  installmentCount: null,
  description: '',
};

/**
 * Hook para gerenciar simulações em memória (não persiste no banco)
 */
export function useSimulation(options: UseSimulationOptions): UseSimulationReturn {
  const { accounts, transactionsBase, budgets = [], categories = [], selectedMonth } = options;

  const [simulation, setSimulation] = useState<SimulationState>(initialState);

  const { t, i18n } = useTranslation();
  const currentLocale = (i18n.language || 'pt-BR') as SupportedLocale;
  const config = LOCALE_CONFIG[currentLocale] || LOCALE_CONFIG['pt-BR'];

  const formatCurrencyLocal = useCallback((value: number) => {
    return new Intl.NumberFormat(config.numberFormat, {
      style: 'currency',
      currency: config.currency
    }).format(value);
  }, [config]);

  /**
   * Inicia uma simulação de adiamento
   */
  const startPostponementSimulation = useCallback((transaction: Transaction, newDueDate: string) => {
    const monthName = new Date(newDueDate + 'T12:00:00').toLocaleDateString(config.dateLocale, { month: 'long', year: 'numeric' });
    setSimulation({
      isActive: true,
      type: 'postponement',
      originalTransaction: transaction,
      simulatedDueDate: newDueDate,
      installmentCount: null,
      description: t('simulation.postponement.descriptionFormat', {
        description: transaction.description || t('transactions.kind.expense'),
        month: monthName
      }),
    });
  }, [t, config]);

  /**
   * Inicia uma simulação de parcelamento
   */
  const startInstallmentSimulation = useCallback((transaction: Transaction, installmentCount: number) => {
    const installmentAmount = Number(transaction.amount) / installmentCount;
    const formattedAmount = formatCurrencyLocal(installmentAmount);
    
    setSimulation({
      isActive: true,
      type: 'installment',
      originalTransaction: transaction,
      simulatedDueDate: null,
      installmentCount,
      description: t('simulation.installment.descriptionFormat', {
        description: transaction.description || t('transactions.kind.expense'),
        count: installmentCount,
        amount: formattedAmount
      }),
    });
  }, [t, formatCurrencyLocal]);

  /**
   * Inicia uma simulação de exclusão
   */
  const startDeletionSimulation = useCallback((transaction: Transaction) => {
    const formattedAmount = formatCurrencyLocal(Number(transaction.amount));
    
    setSimulation({
      isActive: true,
      type: 'deletion',
      originalTransaction: transaction,
      simulatedDueDate: null,
      installmentCount: null,
      description: t('simulation.deletion.descriptionFormat', {
        description: transaction.description || t('transactions.kind.expense'),
        amount: formattedAmount
      }),
    });
  }, [t, formatCurrencyLocal]);

  /**
   * Limpa a simulação ativa
   */
  const clearSimulation = useCallback(() => {
    setSimulation(initialState);
  }, []);

  /**
   * Transações com a simulação aplicada (override)
   */
  const simulatedTransactions = useMemo(() => {
    if (!simulation.isActive || !simulation.originalTransaction) {
      return transactionsBase;
    }

    if (simulation.type === 'postponement' && simulation.simulatedDueDate) {
      return updateSimulatedTransaction(
        transactionsBase,
        simulation.originalTransaction.id,
        { due_date: simulation.simulatedDueDate }
      );
    }

    if (simulation.type === 'installment' && simulation.installmentCount) {
      return simulateInstallments(
        transactionsBase,
        simulation.originalTransaction,
        simulation.installmentCount
      );
    }

    if (simulation.type === 'deletion') {
      return removeSimulatedTransaction(
        transactionsBase,
        simulation.originalTransaction.id
      );
    }

    return transactionsBase;
  }, [transactionsBase, simulation]);

  /**
   * Resultado do motor de risco ANTES da simulação (dados reais)
   */
  const riskResultBefore = useMemo(() => {
    if (!simulation.isActive || !accounts.length) {
      return null;
    }

    return motorRisco({
      accounts,
      transactionsBase,
      // Sem override - dados reais
      budgets,
      categories,
      selectedMonth,
    });
  }, [accounts, transactionsBase, budgets, categories, selectedMonth, simulation.isActive]);

  /**
   * Resultado do motor de risco DEPOIS da simulação
   */
  const riskResult = useMemo(() => {
    if (!simulation.isActive || !accounts.length) {
      return null;
    }

    return motorRisco({
      accounts,
      transactionsBase,
      transactionsOverride: simulatedTransactions,
      budgets,
      categories,
      selectedMonth,
    });
  }, [accounts, transactionsBase, simulatedTransactions, budgets, categories, selectedMonth, simulation.isActive]);

  /**
   * Comparação entre antes e depois
   */
  const comparison = useMemo<SimulationComparison | null>(() => {
    if (!riskResultBefore || !riskResult) {
      return null;
    }

    const beforeBalance = riskResultBefore.totals.projectedBalance;
    const afterBalance = riskResult.totals.projectedBalance;
    const difference = afterBalance - beforeBalance;

    const beforePendingExpenses = riskResultBefore.totals.pendingExpenses;
    const afterPendingExpenses = riskResult.totals.pendingExpenses;
    const expensesDifference = afterPendingExpenses - beforePendingExpenses;

    return {
      beforeBalance,
      afterBalance,
      difference,
      isImprovement: difference > 0,
      beforePendingExpenses,
      afterPendingExpenses,
      expensesDifference,
    };
  }, [riskResultBefore, riskResult]);

  return {
    simulation,
    simulatedTransactions,
    riskResult,
    riskResultBefore,
    comparison,
    startPostponementSimulation,
    startInstallmentSimulation,
    startDeletionSimulation,
    clearSimulation,
    isSimulating: simulation.isActive,
  };
}
