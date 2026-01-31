import '@testing-library/jest-dom/vitest';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TransactionFormDialog } from '@/components/transactions/TransactionForm/TransactionFormDialog';
import { useForm, FormProvider } from 'react-hook-form';
import { TooltipProvider } from '@/components/ui/tooltip';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';

// --- 1. MOCKS DE AMBIENTE ---
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
};

// --- 2. MOCKS DE HOOKS (CORRIGIDOS) ---
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 'user-123' },
    member: { id: 'member-123', name: 'Test User' },
    householdId: 'house-123',
    loading: false,
  }),
  AuthProvider: ({ children }: any) => <div>{children}</div>
}));

vi.mock('@/hooks/useDescriptionSuggestions', () => ({
  useDescriptionSuggestions: () => ({
    suggestions: [], // <--- CHAVE CORRETA: 'suggestions', não 'data'
    isLoading: false
  })
}));

vi.mock('@/hooks/usePredictTransaction', () => ({
  usePredictTransaction: () => ({
    prediction: null,
    hasPrediction: false,
    isLoading: false
  })
}));

vi.mock('@/hooks/useCategorySuggestion', () => ({
  useCategorySuggestion: () => ({
    categorySuggestion: null,
    isLoading: false
  })
}));

vi.mock('@/i18n/useLocale', () => ({
  useLocale: () => ({ t: (key: string) => key })
}));

vi.mock('@/hooks/useLastCategoryTransaction', () => ({
  useLastCategoryTransaction: () => ({ defaults: null, isLoading: false })
}));

vi.mock('@/components/ui/calendar', () => ({
  Calendar: () => <div data-testid="mock-calendar" />
}));

// --- 3. TEST HARNESS ---
const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: false } },
});

const TestHarness = (props: any) => {
  const form = useForm({
    defaultValues: {
      kind: 'EXPENSE',
      amount: 0, // <--- CORREÇÃO: Usar 0 em vez de ''
      description: '',
      date: new Date(),
      account_id: '',
      payment_method: 'debit'
    }
  });

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <FormProvider {...form}>
          <TransactionFormDialog {...props} form={form} />
        </FormProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

describe('TransactionFormDialog Component (Robustness)', () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    editingId: null,
    formKind: 'EXPENSE' as const,
    setFormKind: vi.fn(),
    formAccountId: 'acc-1',
    setFormAccountId: vi.fn(),
    formToAccountId: undefined,
    setFormToAccountId: vi.fn(),
    formCategoryId: undefined,
    setFormCategoryId: vi.fn(),
    formSubcategoryId: undefined,
    setFormSubcategoryId: vi.fn(),
    formAmount: 100,
    setFormAmount: vi.fn(),
    formDate: '2026-01-31',
    setFormDate: vi.fn(),
    formDescription: 'Teste',
    setFormDescription: vi.fn(),
    formMemberId: 'mem-1',
    setFormMemberId: vi.fn(),
    formIsPlanned: false,
    setFormIsPlanned: vi.fn(),
    isEditingConfirmed: false,
    isEditingPastMonth: false,
    isFieldsLocked: false,
    formIsInstallment: false,
    setFormIsInstallment: vi.fn(),
    formInstallmentCount: 1,
    setFormInstallmentCount: vi.fn(),
    formInstallmentDueDate: '',
    setFormInstallmentDueDate: vi.fn(),
    formIsRecurring: false,
    setFormIsRecurring: vi.fn(),
    formRecurringStartMonth: '',
    setFormRecurringStartMonth: vi.fn(),
    formRecurringEndMonth: '',
    setFormRecurringEndMonth: vi.fn(),
    formHasEndMonth: false,
    setFormHasEndMonth: vi.fn(),
    formDayOfMonth: 1,
    setFormDayOfMonth: vi.fn(),
    formPaymentMethod: 'debit' as const,
    setFormPaymentMethod: vi.fn(),
    formCreditCardId: undefined,
    setFormCreditCardId: vi.fn(),
    accounts: [],
    selectableCategories: [],
    selectableSubcategories: [],
    members: [],
    creditCards: [],
    budgetWarning: null,
    descriptionSuggestions: [],
    categorySuggestion: null,
    showCategorySuggestion: false,
    amountInputRef: { current: null },
    justSavedTransaction: null,
    onCreateSimilar: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    isMutationPending: false,
  };

  it('NÃO DEVE quebrar se as listas forem undefined', () => {
    render(
      <TestHarness 
        {...defaultProps}
        accounts={undefined as any}
        selectableCategories={undefined as any}
      />
    );
    expect(screen.getByTestId('transaction-form-dialog')).toBeInTheDocument();
  });

  it('Deve renderizar o campo de valor (HeroAmountInput)', () => {
    render(<TestHarness {...defaultProps} />);
    expect(screen.getByTestId('form-amount')).toBeInTheDocument();
  });
});