import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useTransactionForm } from '@/components/transactions/TransactionForm/useTransactionForm';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// --- MOCKS ---

// 1. Supabase
const mockRpc = vi.fn().mockResolvedValue({ data: null, error: null });
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { 
    rpc: (...args: any[]) => mockRpc(...args) 
  }
}));

// 2. Auth Context (Simulando o hook useAuth diretamente)
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    member: { id: 'user-123' },
    householdId: 'house-123',
    user: { id: 'user-123' },
    signOut: vi.fn(),
  }),
  AuthProvider: ({ children }: any) => children // Mock do Provider se algum componente interno pedir
}));

// 3. Hooks dependentes
vi.mock('@/hooks/useTransactionPreferences', () => ({
  useTransactionPreferences: () => ({
    lastAccountId: 'acc-default',
    savePreferences: vi.fn()
  })
}));

vi.mock('@/hooks/useBudgetValidation', () => ({
  useBudgetValidation: () => ({ warning: null })
}));

vi.mock('@/hooks/useDescriptionSuggestions', () => ({
  useDescriptionSuggestions: () => ({ data: [] })
}));

vi.mock('@/hooks/useCategorySuggestion', () => ({
  useCategorySuggestion: () => ({ data: null })
}));

vi.mock('@/i18n/useLocale', () => ({
  useLocale: () => ({
    t: (key: string) => key
  })
}));

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() }
}));

// --- WRAPPER SIMPLIFICADO (Sem AuthContext.Provider problemático) ---

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } }
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useTransactionForm Hook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve iniciar com valores padrão (EXPENSE)', async () => {
    const { result } = renderHook(() => useTransactionForm(), { wrapper: createWrapper() });
    expect(result.current.form.getValues('kind')).toBe('EXPENSE');
  });

  it('deve sanitizar dados de TRANSFERÊNCIA no submit', async () => {
    const { result } = renderHook(() => useTransactionForm(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.form.setValue('kind', 'TRANSFER');
      result.current.form.setValue('amount', 100);
      result.current.form.setValue('account_id', 'acc-1');
      result.current.form.setValue('to_account_id', 'acc-2');
      result.current.form.setValue('description', 'Transf Teste');
      result.current.form.setValue('payment_method', 'credit'); 
    });

    await act(async () => {
      await result.current.submitTransaction();
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'create_transaction_secure',
      expect.objectContaining({
        p_kind: 'TRANSFER',
        p_payment_method: null
      })
    );
  });

  it('deve remover credit_card_id se mudar para débito', async () => {
    const { result } = renderHook(() => useTransactionForm(), { wrapper: createWrapper() });

    await act(async () => {
      result.current.form.setValue('kind', 'EXPENSE');
      result.current.form.setValue('amount', 50);
      result.current.form.setValue('description', 'Teste Cartão');
      result.current.form.setValue('account_id', 'acc-1');
      result.current.form.setValue('payment_method', 'debit');
      result.current.form.setValue('credit_card_id', 'card-123');
    });

    await act(async () => {
      await result.current.submitTransaction();
    });

    expect(mockRpc).toHaveBeenCalledWith(
      'create_transaction_secure',
      expect.objectContaining({
        p_payment_method: 'debit',
        p_credit_card_id: null
      })
    );
  });
});