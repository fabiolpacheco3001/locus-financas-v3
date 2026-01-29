import { describe, it, expect } from 'vitest';
import { computeMonthlySnapshot, isInMonth, getEffectiveDate } from '@/domain/finance';
import { Transaction } from '@/types/finance';

// Alias for backward compatibility
const calculateMonthlyMetrics = (transactions: Transaction[], month: Date) => {
  const snapshot = computeMonthlySnapshot(transactions, month);
  return {
    incomeRealized: snapshot.incomeRealized,
    expenseRealized: snapshot.expenseRealized,
    saldoMes: snapshot.saldoMes,
    aPagarMes: snapshot.expensePlanned,
    incomePlanned: snapshot.incomePlanned,
    saldoPrevistoMes: snapshot.saldoPrevistoMes,
    plannedIncomeCount: snapshot.plannedIncomeCount,
    plannedExpenseCount: snapshot.plannedExpenseCount,
    confirmedCount: snapshot.confirmedCount,
    totalCount: snapshot.totalCount,
  };
};

// Helper to create test transactions
function createTransaction(overrides: Partial<Transaction>): Transaction {
  return {
    id: 'tx-' + Math.random().toString(36).substr(2, 9),
    household_id: 'household-1',
    account_id: 'account-1',
    amount: 100,
    kind: 'EXPENSE',
    status: 'confirmed',
    date: '2025-01-15',
    due_date: null,
    description: 'Test transaction',
    category_id: null,
    subcategory_id: null,
    member_id: null,
    expense_type: null,
    installment_group_id: null,
    installment_number: null,
    installment_total: null,
    to_account_id: null,
    confirmed_at: null,
    confirmed_by: null,
    cancelled_at: null,
    cancelled_by: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('financeMetrics - calculateMonthlyMetrics', () => {
  // Use dates in 2024 to ensure they are always in the past (tests run in 2026+)
  const january2024 = new Date(2024, 0, 15);

  describe('incomeRealized (receitas confirmadas)', () => {
    it('should sum confirmed income in the selected month', () => {
      const transactions = [
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 1000, date: '2024-01-10' }),
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 500, date: '2024-01-20' }),
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 200, date: '2024-02-01' }), // Different month
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.incomeRealized).toBe(1500);
    });

    it('should not count planned income as realized', () => {
      const transactions = [
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 1000, date: '2024-01-10' }),
        createTransaction({ kind: 'INCOME', status: 'planned', amount: 500, date: '2024-01-20' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.incomeRealized).toBe(1000);
    });
  });

  describe('expenseRealized (despesas confirmadas)', () => {
    it('should sum confirmed expenses in the selected month using due_date', () => {
      const transactions = [
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 300, date: '2024-01-05', due_date: '2024-01-15' }),
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 200, date: '2024-01-10', due_date: '2024-01-25' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.expenseRealized).toBe(500);
    });

    it('should use date when due_date is null', () => {
      const transactions = [
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 400, date: '2024-01-20', due_date: null }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.expenseRealized).toBe(400);
    });

    it('should not count cancelled expenses', () => {
      const transactions = [
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 300, date: '2024-01-15' }),
        createTransaction({ kind: 'EXPENSE', status: 'cancelled', amount: 200, date: '2024-01-20' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.expenseRealized).toBe(300);
    });
  });

  describe('aPagarMes (planned expenses - a pagar)', () => {
    it('should sum planned expenses in the selected month', () => {
      const transactions = [
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 150, due_date: '2024-01-10' }),
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 250, due_date: '2024-01-20' }),
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 100, due_date: '2024-02-05' }), // Different month
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.aPagarMes).toBe(400);
    });

    it('should not count confirmed expenses as planned', () => {
      const transactions = [
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 200, due_date: '2024-01-15' }),
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 300, due_date: '2024-01-15' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.aPagarMes).toBe(200);
    });
  });

  describe('saldoPrevistoMes (projected balance)', () => {
    it('should calculate (income confirmed + planned) - (expense confirmed + planned)', () => {
      const transactions = [
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 3000, date: '2024-01-05' }),
        createTransaction({ kind: 'INCOME', status: 'planned', amount: 500, date: '2024-01-25' }),
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 1000, due_date: '2024-01-10' }),
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 800, due_date: '2024-01-20' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      
      // (3000 + 500) - (1000 + 800) = 3500 - 1800 = 1700
      expect(result.saldoPrevistoMes).toBe(1700);
    });

    it('should return negative when expenses exceed income', () => {
      const transactions = [
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 1000, date: '2024-01-05' }),
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 800, due_date: '2024-01-10' }),
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 500, due_date: '2024-01-20' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      
      // 1000 - (800 + 500) = 1000 - 1300 = -300
      expect(result.saldoPrevistoMes).toBe(-300);
    });
  });

  describe('saldoMes (realized balance)', () => {
    it('should calculate incomeRealized - expenseRealized', () => {
      const transactions = [
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 2000, date: '2024-01-10' }),
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 1200, due_date: '2024-01-15' }),
      ];

      const result = calculateMonthlyMetrics(transactions, january2024);
      expect(result.saldoMes).toBe(800);
    });
  });

  describe('strict status-based logic (NO date dependency for realized/pending)', () => {
    // Tests for the STRICT STATUS-BASED logic where:
    // - Realized = status === 'confirmed' (REGARDLESS of date)
    // - Pending = status === 'planned' (REGARDLESS of date)
    // This ensures that marking something as "confirmed" immediately moves it to "Realized"
    
    it('should treat ALL confirmed expenses as realized regardless of date', () => {
      // Use dates in the past relative to today for consistent testing
      const pastMonth = new Date(2024, 0, 15); // Jan 2024 (past)
      const transactions = [
        createTransaction({ 
          kind: 'EXPENSE', 
          status: 'confirmed', 
          amount: 500, 
          date: '2024-01-01',
          due_date: '2024-01-10' // Past date
        }),
        createTransaction({ 
          kind: 'EXPENSE', 
          status: 'planned', 
          amount: 300, 
          due_date: '2024-01-15'
        }),
      ];

      const result = calculateMonthlyMetrics(transactions, pastMonth);
      
      // Confirmed = realized (strict), Planned = pending
      expect(result.expenseRealized).toBe(500);
      expect(result.aPagarMes).toBe(300);
    });

    it('should treat confirmed expenses with FUTURE date as REALIZED (strict status-based)', () => {
      // Use dates in the future for this test - key difference from hybrid!
      const futureMonth = new Date(2099, 1, 15); // Feb 2099 (far future)
      const transactions = [
        createTransaction({ 
          kind: 'EXPENSE', 
          status: 'confirmed',  // <-- CONFIRMED means realized, even if future!
          amount: 500, 
          date: '2099-02-01',
          due_date: '2099-02-20' // Future date - but still counts as realized!
        }),
        createTransaction({ 
          kind: 'EXPENSE', 
          status: 'planned',  // <-- PLANNED means pending
          amount: 300, 
          due_date: '2099-02-15'
        }),
      ];

      const result = calculateMonthlyMetrics(transactions, futureMonth);
      
      // STRICT LOGIC: Confirmed = realized, Planned = pending (date irrelevant)
      expect(result.expenseRealized).toBe(500); // Confirmed is always realized
      expect(result.aPagarMes).toBe(300); // Only planned is pending
    });

    it('should treat confirmed income with any date as realized', () => {
      const pastMonth = new Date(2024, 0, 15); // Jan 2024 (past)
      const transactions = [
        createTransaction({ 
          kind: 'INCOME', 
          status: 'confirmed', 
          amount: 1000, 
          date: '2024-01-10' // Past date = realized
        }),
        createTransaction({ 
          kind: 'INCOME', 
          status: 'planned', 
          amount: 500, 
          date: '2024-01-25'
        }),
      ];

      const result = calculateMonthlyMetrics(transactions, pastMonth);
      
      // Confirmed = realized, Planned = pending
      expect(result.incomeRealized).toBe(1000);
      expect(result.incomePlanned).toBe(500);
    });

    it('should correctly calculate forecast with strict status-based logic', () => {
      const pastMonth = new Date(2024, 0, 15); // Jan 2024 (past)
      const transactions = [
        // Confirmed = realized (regardless of date)
        createTransaction({ kind: 'INCOME', status: 'confirmed', amount: 2000, date: '2024-01-05' }),
        createTransaction({ kind: 'EXPENSE', status: 'confirmed', amount: 800, due_date: '2024-01-10' }),
        // Planned = pending
        createTransaction({ kind: 'EXPENSE', status: 'planned', amount: 400, due_date: '2024-01-20' }),
      ];

      const result = calculateMonthlyMetrics(transactions, pastMonth);
      
      // Realized: 2000 - 800 = 1200
      expect(result.incomeRealized).toBe(2000);
      expect(result.expenseRealized).toBe(800);
      expect(result.saldoMes).toBe(1200);
      
      // Pending: only the planned expense
      expect(result.aPagarMes).toBe(400);
      
      // Forecast: 2000 - (800 + 400) = 800
      expect(result.saldoPrevistoMes).toBe(800);
    });

    it('should NOT include confirmed future-dated transactions in pending', () => {
      // This is the KEY test for the user's requirement:
      // A confirmed transaction should NEVER appear in "A Pagar" - even if future-dated
      const futureMonth = new Date(2099, 5, 15); // Jun 2099
      const transactions = [
        createTransaction({ 
          kind: 'EXPENSE', 
          status: 'confirmed',  // Already paid/scheduled
          amount: 1000, 
          date: '2099-06-01',
          due_date: '2099-06-25'  // Future, but already confirmed
        }),
        createTransaction({ 
          kind: 'EXPENSE', 
          status: 'planned',  // Not paid yet
          amount: 200, 
          due_date: '2099-06-15'
        }),
      ];

      const result = calculateMonthlyMetrics(transactions, futureMonth);
      
      // The R$ 1000 confirmed should be in "Realized", NOT in "A Pagar"
      expect(result.expenseRealized).toBe(1000);  // Confirmed = realized
      expect(result.aPagarMes).toBe(200);         // Only planned = pending
      
      // Count validation
      expect(result.plannedExpenseCount).toBe(1);  // Only the planned one
    });
  });
});

describe('financeMetrics - getEffectiveDate', () => {
  it('should return due_date for EXPENSE when available', () => {
    const tx = createTransaction({ kind: 'EXPENSE', date: '2025-01-10', due_date: '2025-01-20' });
    expect(getEffectiveDate(tx)).toBe('2025-01-20');
  });

  it('should fallback to date for EXPENSE when due_date is null', () => {
    const tx = createTransaction({ kind: 'EXPENSE', date: '2025-01-10', due_date: null });
    expect(getEffectiveDate(tx)).toBe('2025-01-10');
  });

  // INCOME and TRANSFER use date directly (aligned with computeUnifiedMetrics)
  it('should use date for INCOME regardless of due_date', () => {
    const tx = createTransaction({ kind: 'INCOME', date: '2025-01-10', due_date: '2025-01-20' });
    expect(getEffectiveDate(tx)).toBe('2025-01-10');
  });

  it('should use date for TRANSFER regardless of due_date', () => {
    const tx = createTransaction({ kind: 'TRANSFER', date: '2025-01-10', due_date: '2025-01-20' });
    expect(getEffectiveDate(tx)).toBe('2025-01-10');
  });
});

describe('financeMetrics - isInMonth', () => {
  const january2025 = new Date(2025, 0, 15);

  it('should return true for transaction in the same month', () => {
    const tx = createTransaction({ date: '2025-01-15' });
    expect(isInMonth(tx, january2025)).toBe(true);
  });

  it('should return false for transaction in different month', () => {
    const tx = createTransaction({ date: '2025-02-15' });
    expect(isInMonth(tx, january2025)).toBe(false);
  });

  it('should include first day of month', () => {
    const tx = createTransaction({ date: '2025-01-01' });
    expect(isInMonth(tx, january2025)).toBe(true);
  });

  it('should include last day of month', () => {
    const tx = createTransaction({ date: '2025-01-31' });
    expect(isInMonth(tx, january2025)).toBe(true);
  });
});

// NOTE: calculateAvailableBalance tests have been REMOVED
// Balance calculation is now handled by Postgres RPC functions:
// - get_account_balance(account_id)
// - get_accounts_with_balances()
// See: src/hooks/useAccounts.ts for the Database-First implementation
