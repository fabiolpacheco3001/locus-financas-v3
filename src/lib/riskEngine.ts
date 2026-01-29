import { Account, Transaction, Budget, Category } from '@/types/finance';
import { parseISO, isAfter, endOfMonth } from 'date-fns';
import { getEffectiveDate } from '@/lib/financeMetrics';

// ========================
// Tipos do Motor de Risco
// ========================

export interface PlannedTransactionDetail {
  id: string;
  date: string;
  description: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  amount: number;
}

export interface AccountProjection {
  account: Account & { calculated_balance?: number };
  realizedBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  isNegativeProjected: boolean;
  plannedIncomes: PlannedTransactionDetail[];
  plannedExpenses: PlannedTransactionDetail[];
}

export interface ProjectionTotals {
  realizedBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
}

export interface BudgetAlert {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  budgetAmount: number;
  realizedAmount: number;
  pendingAmount: number;
  totalAmount: number;
  percentUsed: number;
  status: 'ok' | 'warning' | 'over';
}

export interface RiskEngineInput {
  accounts: Account[];
  transactionsBase: Transaction[];
  transactionsOverride?: Transaction[];
  budgets?: Budget[];
  categories?: Category[];
  selectedMonth: Date;
}

export interface RiskEngineOutput {
  projections: AccountProjection[];
  negativeProjectedAccounts: AccountProjection[];
  totals: ProjectionTotals;
  budgetAlerts: BudgetAlert[];
  overBudgetCount: number;
  warningCount: number;
}

// ========================
// Funções Puras do Motor
// ========================

/**
 * Calcula as projeções de saldo por conta
 */
function calculateAccountProjections(
  accounts: Account[],
  transactions: Transaction[],
  selectedMonth: Date
): AccountProjection[] {
  const endOfSelectedMonth = endOfMonth(selectedMonth);

  return accounts.map((account): AccountProjection => {
    let realizedBalance = 0;
    let pendingIncome = 0;
    let pendingExpenses = 0;
    const plannedIncomes: PlannedTransactionDetail[] = [];
    const plannedExpenses: PlannedTransactionDetail[] = [];

    transactions.forEach((t) => {
      const amount = Number(t.amount);
      // Use shared effective date logic: EXPENSE uses due_date (fallback date), others use date
      const effectiveDate = parseISO(getEffectiveDate(t));
      const isWithinProjectionPeriod = !isAfter(effectiveDate, endOfSelectedMonth);

      if (t.status === 'confirmed') {
        // Confirmed transactions count towards realized balance (regardless of due_date)
        if (t.kind === 'INCOME' && t.account_id === account.id) {
          realizedBalance += amount;
        } else if (t.kind === 'EXPENSE' && t.account_id === account.id) {
          realizedBalance -= amount;
        } else if (t.kind === 'TRANSFER') {
          if (t.account_id === account.id) {
            realizedBalance -= amount;
          }
          if (t.to_account_id === account.id) {
            realizedBalance += amount;
          }
        }
      } else if (t.status === 'planned' && isWithinProjectionPeriod) {
        // ONLY planned transactions count as pending - never include confirmed here
        if (t.kind === 'INCOME' && t.account_id === account.id) {
          pendingIncome += amount;
          plannedIncomes.push({
            id: t.id,
            date: t.date,
            description: t.description,
            categoryName: (t as any).category?.name || null,
            subcategoryName: (t as any).subcategory?.name || null,
            amount,
          });
        } else if (t.kind === 'EXPENSE' && t.account_id === account.id) {
          pendingExpenses += amount;
          plannedExpenses.push({
            id: t.id,
            date: t.date,
            description: t.description,
            categoryName: (t as any).category?.name || null,
            subcategoryName: (t as any).subcategory?.name || null,
            amount,
          });
        }
      }
    });

    // Sort by amount descending
    plannedIncomes.sort((a, b) => b.amount - a.amount);
    plannedExpenses.sort((a, b) => b.amount - a.amount);

    const projectedBalance = realizedBalance + pendingIncome - pendingExpenses;

    return {
      account,
      realizedBalance,
      projectedBalance,
      pendingIncome,
      pendingExpenses,
      isNegativeProjected: projectedBalance < 0,
      plannedIncomes,
      plannedExpenses,
    };
  });
}

/**
 * Calcula os alertas de orçamento
 */
function calculateBudgetAlerts(
  transactions: Transaction[],
  budgets: Budget[],
  categories: Category[]
): BudgetAlert[] {
  if (!budgets.length || !transactions.length) return [];

  const budgetAlerts: BudgetAlert[] = [];

  budgets.forEach((budget) => {
    if (Number(budget.planned_amount) === 0) return;

    const category = categories.find((c) => c.id === budget.category_id);
    if (!category) return;

    // Get transactions for this budget (category + optional subcategory)
    const relevantTransactions = transactions.filter((t) => {
      if (t.kind !== 'EXPENSE') return false;
      if (t.category_id !== budget.category_id) return false;
      if (budget.subcategory_id && t.subcategory_id !== budget.subcategory_id) return false;
      return true;
    });

    const realizedAmount = relevantTransactions
      .filter((t) => t.status === 'confirmed')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const pendingAmount = relevantTransactions
      .filter((t) => t.status === 'planned')
      .reduce((sum, t) => sum + Number(t.amount), 0);

    const totalAmount = realizedAmount + pendingAmount;
    const budgetAmount = Number(budget.planned_amount);
    const percentUsed = budgetAmount > 0 ? (totalAmount / budgetAmount) * 100 : 0;

    // Only include if over budget or close to it
    if (percentUsed >= 80) {
      const subcategory = budget.subcategory_id
        ? category.subcategories?.find((s) => s.id === budget.subcategory_id)
        : null;

      budgetAlerts.push({
        categoryId: budget.category_id,
        categoryName: category.name,
        subcategoryId: budget.subcategory_id,
        subcategoryName: subcategory?.name || null,
        budgetAmount,
        realizedAmount,
        pendingAmount,
        totalAmount,
        percentUsed,
        status: percentUsed > 100 ? 'over' : 'warning',
      });
    }
  });

  // Sort by percentage used (highest first)
  return budgetAlerts.sort((a, b) => b.percentUsed - a.percentUsed);
}

// ========================
// Motor de Risco Principal
// ========================

/**
 * Motor de Risco - Calcula projeções e alertas com suporte a simulação em memória
 * 
 * @param input.accounts - Lista de contas
 * @param input.transactionsBase - Transações base do banco
 * @param input.transactionsOverride - (Opcional) Transações simuladas que substituem as base
 * @param input.budgets - (Opcional) Orçamentos para cálculo de alertas
 * @param input.categories - (Opcional) Categorias para cálculo de alertas
 * @param input.selectedMonth - Mês de referência para projeções
 * 
 * @returns Projeções por conta, totais e alertas de orçamento
 */
export function motorRisco(input: RiskEngineInput): RiskEngineOutput {
  const {
    accounts,
    transactionsBase,
    transactionsOverride,
    budgets = [],
    categories = [],
    selectedMonth,
  } = input;

  // Se override existir, usar override no cálculo (simulação em memória)
  const transactions = transactionsOverride ?? transactionsBase;

  // Filtrar apenas transações ativas (não canceladas)
  const activeTransactions = transactions.filter(t => t.status !== 'cancelled');

  // Calcular projeções por conta
  const projections = calculateAccountProjections(accounts, activeTransactions, selectedMonth);

  // Contas com projeção negativa
  const negativeProjectedAccounts = projections.filter((p) => p.isNegativeProjected);

  // Totais consolidados
  const totals = projections.reduce(
    (acc, p) => ({
      realizedBalance: acc.realizedBalance + p.realizedBalance,
      projectedBalance: acc.projectedBalance + p.projectedBalance,
      pendingIncome: acc.pendingIncome + p.pendingIncome,
      pendingExpenses: acc.pendingExpenses + p.pendingExpenses,
    }),
    { realizedBalance: 0, projectedBalance: 0, pendingIncome: 0, pendingExpenses: 0 }
  );

  // Calcular alertas de orçamento
  const budgetAlerts = calculateBudgetAlerts(activeTransactions, budgets, categories);
  const overBudgetCount = budgetAlerts.filter((a) => a.status === 'over').length;
  const warningCount = budgetAlerts.filter((a) => a.status === 'warning').length;

  return {
    projections,
    negativeProjectedAccounts,
    totals,
    budgetAlerts,
    overBudgetCount,
    warningCount,
  };
}

// ========================
// Utilitários de Simulação
// ========================

export interface SimulatedTransaction {
  id?: string;
  account_id: string;
  to_account_id?: string | null;
  kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  amount: number;
  date: string;
  due_date?: string | null;
  status: 'planned' | 'confirmed';
  category_id?: string | null;
  subcategory_id?: string | null;
  description?: string | null;
}

/**
 * Cria uma cópia das transações base com uma transação simulada adicionada
 */
export function addSimulatedTransaction(
  transactionsBase: Transaction[],
  simulated: SimulatedTransaction
): Transaction[] {
  const newTransaction: Transaction = {
    id: simulated.id || `simulated-${Date.now()}`,
    household_id: transactionsBase[0]?.household_id || '',
    account_id: simulated.account_id,
    to_account_id: simulated.to_account_id || null,
    category_id: simulated.category_id || null,
    subcategory_id: simulated.subcategory_id || null,
    member_id: null,
    kind: simulated.kind,
    amount: simulated.amount,
    date: simulated.date,
    description: simulated.description || null,
    status: simulated.status,
    confirmed_at: simulated.status === 'confirmed' ? new Date().toISOString() : null,
    confirmed_by: null,
    cancelled_at: null,
    cancelled_by: null,
    expense_type: null,
    due_date: simulated.due_date || simulated.date,
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    payment_method: null,
    credit_card_id: null,
    invoice_month: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  return [...transactionsBase, newTransaction];
}

/**
 * Cria uma cópia das transações base com uma transação modificada
 */
export function updateSimulatedTransaction(
  transactionsBase: Transaction[],
  transactionId: string,
  updates: Partial<Transaction>
): Transaction[] {
  return transactionsBase.map((t) =>
    t.id === transactionId ? { ...t, ...updates } : t
  );
}

/**
 * Cria uma cópia das transações base com uma transação removida
 */
export function removeSimulatedTransaction(
  transactionsBase: Transaction[],
  transactionId: string
): Transaction[] {
  return transactionsBase.filter((t) => t.id !== transactionId);
}

/**
 * Cria uma cópia das transações base com uma transação cancelada
 */
export function cancelSimulatedTransaction(
  transactionsBase: Transaction[],
  transactionId: string
): Transaction[] {
  return transactionsBase.map((t) =>
    t.id === transactionId 
      ? { ...t, status: 'cancelled' as const, cancelled_at: new Date().toISOString() } 
      : t
  );
}

/**
 * Simula parcelamento de uma despesa
 * Remove a despesa original e cria N parcelas com due_date mensal sequencial
 */
export function simulateInstallments(
  transactionsBase: Transaction[],
  originalTransaction: Transaction,
  installmentCount: number
): Transaction[] {
  // Validações
  if (installmentCount < 2 || installmentCount > 12) {
    throw new Error('Número de parcelas deve ser entre 2 e 12');
  }

  const installmentAmount = Number(originalTransaction.amount) / installmentCount;
  const groupId = `simulated-installment-${Date.now()}`;
  
  // Parsear a data de vencimento original
  const baseDueDate = originalTransaction.due_date || originalTransaction.date;
  const baseDate = new Date(baseDueDate + 'T12:00:00');
  
  // Criar as parcelas simuladas
  const installments: Transaction[] = [];
  
  for (let i = 0; i < installmentCount; i++) {
    const installmentDueDate = new Date(baseDate);
    installmentDueDate.setMonth(installmentDueDate.getMonth() + i);
    
    const installment: Transaction = {
      id: `${groupId}-${i + 1}`,
      household_id: originalTransaction.household_id,
      account_id: originalTransaction.account_id,
      to_account_id: null,
      category_id: originalTransaction.category_id,
      subcategory_id: originalTransaction.subcategory_id,
      member_id: originalTransaction.member_id,
      kind: 'EXPENSE',
      amount: installmentAmount,
      date: originalTransaction.date,
      description: `${originalTransaction.description || 'Despesa'} (${i + 1}/${installmentCount})`,
      status: 'planned',
      confirmed_at: null,
      confirmed_by: null,
      cancelled_at: null,
      cancelled_by: null,
      expense_type: originalTransaction.expense_type,
      due_date: installmentDueDate.toISOString().split('T')[0],
      installment_group_id: groupId,
      installment_number: i + 1,
      installment_total: installmentCount,
      payment_method: originalTransaction.payment_method,
      credit_card_id: originalTransaction.credit_card_id,
      invoice_month: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // Preservar referências de categoria/subcategoria se existirem
      category: originalTransaction.category,
      subcategory: originalTransaction.subcategory,
      account: originalTransaction.account,
      member: originalTransaction.member,
    };
    
    installments.push(installment);
  }
  
  // Remover a transação original e adicionar as parcelas
  const filteredTransactions = transactionsBase.filter(t => t.id !== originalTransaction.id);
  
  return [...filteredTransactions, ...installments];
}
