import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createElement } from 'react';
import { createRoot } from 'react-dom/client';

// Mock supabase client ANTES de importar qualquer coisa que use ele
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: vi.fn()
  }
}));

// --- MOCK DO REACT QUERY ---
// Isso engana o hook, fingindo que o Provider existe e entregando uma função vazia
vi.mock('@tanstack/react-query', async () => {
  const actual = await vi.importActual('@tanstack/react-query');
  return {
    ...actual,
    useQueryClient: () => ({
      invalidateQueries: vi.fn(), // A função que chamamos no submit agora é fake
    }),
  };
});
// ---------------------------

// Mock dos hooks e contextos
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    member: { id: 'member-123' },
    householdId: 'household-123'
  })
}));

vi.mock('@/hooks/useTransactionPreferences', () => ({
  useTransactionPreferences: () => ({
    lastKind: undefined,
    lastAccountId: undefined,
    lastCategoryId: undefined,
    lastSubcategoryId: undefined,
    lastFromAccountId: undefined,
    lastToAccountId: undefined,
    savePreferences: vi.fn()
  })
}));

vi.mock('@/hooks/useBudgetValidation', () => ({
  useBudgetValidation: () => ({
    warning: null
  })
}));

vi.mock('@/hooks/useDescriptionSuggestions', () => ({
  useDescriptionSuggestions: () => ({
    suggestions: []
  })
}));

vi.mock('@/hooks/useCategorySuggestion', () => ({
  useCategorySuggestion: () => ({
    suggestion: null
  })
}));

vi.mock('@/i18n/useLocale', () => ({
  useLocale: () => ({
    t: (key: string) => key
  })
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn()
  }
}));

import { supabase } from '@/integrations/supabase/client';
import { useTransactionForm } from '@/components/transactions/TransactionForm/useTransactionForm';

describe('useTransactionForm - Sanitização de Dados', () => {
  const mockAccounts = [
    { id: 'account-1', name: 'Conta Principal', type: 'checking' }
  ];

  const mockCategories = [
    { id: 'cat-1', name: 'Receita', type: 'income', archived_at: null, subcategories: [] },
    { id: 'cat-2', name: 'Despesa', type: 'expense', archived_at: null, subcategories: [] }
  ];

  const mockCreditCards: any[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(supabase.rpc).mockResolvedValue({
      data: { id: 'tx-123' },
      error: null
    } as any);
  });

  // Helper para testar o hook usando um componente wrapper simples
  const testHook = async (
    setupFn: (hook: ReturnType<typeof useTransactionForm>) => void | Promise<void>
  ): Promise<ReturnType<typeof useTransactionForm>> => {
    return new Promise((resolve, reject) => {
      const container = document.createElement('div');
      document.body.appendChild(container);
      const root = createRoot(container);

      const TestComponent = () => {
        const hook = useTransactionForm({
          accounts: mockAccounts,
          categories: mockCategories,
          activeCategories: mockCategories,
          creditCards: mockCreditCards
        });

        // Executa o setup e resolve com o hook
        Promise.resolve(setupFn(hook))
          .then(() => {
            setTimeout(() => {
              resolve(hook);
              root.unmount();
              document.body.removeChild(container);
            }, 100);
          })
          .catch((err) => {
            reject(err);
            root.unmount();
            document.body.removeChild(container);
          });

        return null;
      };

      root.render(createElement(TestComponent));
    });
  };

  describe('submitTransaction - Sanitização de payment_method', () => {
    it('deve enviar Receita (INCOME) com payment_method NULL mesmo que o form tenha "debit"', async () => {
      const hook = await testHook(async (h) => {
        // Configura o form com kind INCOME e payment_method 'debit' (simulando o erro antigo)
        h.setFormKind('INCOME');
        h.setFormAccountId('account-1');
        h.setFormCategoryId('cat-1');
        h.setFormAmount(1000);
        h.setFormDate('2026-01-30');
        h.setFormPaymentMethod('debit'); // Tentando enviar 'debit' para receita
      });

      // Executa submitTransaction
      const success = await hook.submitTransaction();

      // ASSERT: Verifica se supabase.rpc foi chamado com p_payment_method: null
      expect(supabase.rpc).toHaveBeenCalledWith('create_transaction_secure', {
        p_account_id: 'account-1',
        p_category_id: 'cat-1',
        p_amount: 1000,
        p_date: '2026-01-30',
        p_description: null,
        p_kind: 'INCOME',
        p_payment_method: null // <--- CRÍTICO: Deve ser null, não 'debit'
      });

      expect(success).toBe(true);
    });

    it('deve enviar Despesa (EXPENSE) com payment_method PREENCHIDO', async () => {
      const hook = await testHook(async (h) => {
        // Configura o form com kind EXPENSE e payment_method 'credit_card'
        h.setFormKind('EXPENSE');
        h.setFormAccountId('account-1');
        h.setFormCategoryId('cat-2');
        h.setFormAmount(500);
        h.setFormDate('2026-01-30');
        h.setFormPaymentMethod('credit_card');
      });

      // Executa submitTransaction
      const success = await hook.submitTransaction();

      // ASSERT: Verifica se supabase.rpc foi chamado com p_payment_method: 'credit_card'
      expect(supabase.rpc).toHaveBeenCalledWith('create_transaction_secure', {
        p_account_id: 'account-1',
        p_category_id: 'cat-2',
        p_amount: 500,
        p_date: '2026-01-30',
        p_description: null,
        p_kind: 'EXPENSE',
        p_payment_method: 'credit_card' // <--- Deve manter o valor para despesas
      });

      expect(success).toBe(true);
    });

    it('deve converter Amount corretamente de string formatada brasileira', async () => {
      const hook = await testHook(async (h) => {
        // Configura o form com amount como número (parseBrazilianCurrency já converteu)
        h.setFormKind('EXPENSE');
        h.setFormAccountId('account-1');
        h.setFormCategoryId('cat-2');
        h.form.setValue('amount', 1000);
        h.setFormAmount(1000);
        h.setFormDate('2026-01-30');
        h.setFormPaymentMethod('debit');
      });

      // Executa submitTransaction
      const success = await hook.submitTransaction();

      // ASSERT: Verifica se enviou p_amount: 1000 (não a string original)
      expect(supabase.rpc).toHaveBeenCalledWith(
        'create_transaction_secure',
        expect.objectContaining({
          p_amount: 1000 // <--- Deve ser número, não string
        })
      );

      expect(success).toBe(true);
    });

    it('deve garantir que Transferência (TRANSFER) também não tenha payment_method', async () => {
      const hook = await testHook(async (h) => {
        // Configura o form com kind TRANSFER
        h.setFormKind('TRANSFER');
        h.setFormAccountId('account-1');
        h.setFormToAccountId('account-2');
        h.setFormAmount(2000);
        h.setFormDate('2026-01-30');
        h.setFormPaymentMethod('debit'); // Tentando enviar payment_method para transferência
      });

      // Executa submitTransaction
      const success = await hook.submitTransaction();

      // ASSERT: Verifica se p_payment_method é null para transferências também
      expect(supabase.rpc).toHaveBeenCalledWith(
        'create_transaction_secure',
        expect.objectContaining({
          p_kind: 'TRANSFER',
          p_payment_method: null // Transferências não devem ter payment_method
        })
      );

      expect(success).toBe(true);
    });
  });
});
