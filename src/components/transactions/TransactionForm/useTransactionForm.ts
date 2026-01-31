import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactionPreferences } from '@/hooks/useTransactionPreferences';
import { useBudgetValidation } from '@/hooks/useBudgetValidation';
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions';
import { useCategorySuggestion } from '@/hooks/useCategorySuggestion';
import { Transaction, TransactionKind } from '@/types/finance';
import { PaymentMethod } from '@/types/creditCards';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { toLocalISOString } from '@/lib/dateOnly';

// Schema simplificado - Validações complexas ficam no submit
const transactionFormSchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  account_id: z.string().min(1, 'Selecione uma conta'),
  to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  subcategory_id: z.string().nullable().optional(),
  amount: z.any(), // Validado manualmente para permitir input de string monetária
  date: z.date(),
  description: z.string().min(1, 'Informe uma descrição'),
  payment_method: z.string().nullable().optional(),
  credit_card_id: z.string().nullable().optional(),
  installments_count: z.number().optional(),
  is_recurring: z.boolean().optional(),
  member_id: z.string().nullable().optional(),
});

type TransactionFormData = z.infer<typeof transactionFormSchema>;

interface UseTransactionFormProps {
  accounts?: any[];
  categories?: any[];
  activeCategories?: any[];
  creditCards?: any[];
  isLoadingAccounts?: boolean;
  refetchAccounts?: () => void;
}

export function useTransactionForm(props?: UseTransactionFormProps) {
  const {
    accounts = [],
    categories = [],
    activeCategories = [],
    creditCards = [],
  } = props || {};
  const { t } = useLocale();
  const { user, member, householdId } = useAuth();
  const queryClient = useQueryClient();
  const { savePreferences, ...preferences } = useTransactionPreferences(member?.id);
  
  // Estado local para controle de UI
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formIsPlanned, setFormIsPlanned] = useState(false);
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Inicializa o form
  const form = useForm<TransactionFormData>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: {
      kind: 'EXPENSE',
      date: new Date(),
      amount: '',
      description: '',
      is_recurring: false,
      installments_count: 1,
      account_id: preferences.lastAccountId || '',
      category_id: preferences.lastCategoryId || null,
      payment_method: 'debit',
    },
  });

  // Watchers para UI (apenas leitura, NUNCA disparar setValue aqui)
  const formKind = form.watch('kind');
  const formAmount = form.watch('amount');
  const formDescription = form.watch('description');
  const formCategoryId = form.watch('category_id');
  const formSubcategoryId = form.watch('subcategory_id');
  const formAccountId = form.watch('account_id');
  const formToAccountId = form.watch('to_account_id');
  const formMemberId = form.watch('member_id');
  const formPaymentMethod = form.watch('payment_method') as PaymentMethod;
  const formCreditCardId = form.watch('credit_card_id');
  const formDate = form.watch('date');
  const formIsRecurring = form.watch('is_recurring');
  const formInstallmentCount = form.watch('installments_count') || 1;
  
  // Estados adicionais
  const [formIsInstallment, setFormIsInstallment] = useState(false);
  const [formInstallmentDueDate, setFormInstallmentDueDate] = useState('');
  const [formRecurringStartMonth, setFormRecurringStartMonth] = useState('');
  const [formRecurringEndMonth, setFormRecurringEndMonth] = useState('');
  const [formHasEndMonth, setFormHasEndMonth] = useState(false);
  const [formDayOfMonth, setFormDayOfMonth] = useState(1);
  const [justSavedTransaction, setJustSavedTransaction] = useState<any>(null);

  // Converter formDate de Date para string YYYY-MM-DD
  const formDateString = useMemo(() => {
    if (!formDate) return toLocalISOString(new Date());
    return toLocalISOString(formDate instanceof Date ? formDate : new Date(formDate));
  }, [formDate]);
  
  // Hooks auxiliares
  const budgetWarning = useBudgetValidation({
    amount: formKind === 'EXPENSE' ? Number(formAmount) : 0,
    categoryId: formCategoryId || '',
    competenceDate: formDateString,
    kind: formKind,
  });

  const descriptionSuggestionsResult = useDescriptionSuggestions({ 
    searchTerm: formDescription || '',
    memberId: formMemberId,
    accountId: formAccountId,
    categoryId: formCategoryId,
  });
  const descriptionSuggestions = descriptionSuggestionsResult.suggestions || [];
  
  const categorySuggestionResult = useCategorySuggestion({ 
    description: formDescription || '',
    kind: formKind,
    memberId: formMemberId,
  });
  const categorySuggestion = categorySuggestionResult.suggestion ? {
    categoryId: categorySuggestionResult.suggestion.categoryId,
    categoryName: categorySuggestionResult.suggestion.categoryName,
    subcategoryId: categorySuggestionResult.suggestion.subcategoryId || undefined,
    subcategoryName: categorySuggestionResult.suggestion.subcategoryName || undefined,
  } : null;
  
  // Computar selectableCategories e selectableSubcategories
  const selectableCategories = useMemo(() => {
    return activeCategories.length > 0 ? activeCategories : categories;
  }, [activeCategories, categories]);
  
  const selectableSubcategories = useMemo(() => {
    if (!formCategoryId || !selectableCategories.length) return [];
    const category = selectableCategories.find(c => c.id === formCategoryId);
    return category?.subcategories || [];
  }, [formCategoryId, selectableCategories]);
  
  // Flags de edição
  const isEditingConfirmed = editingId !== null;
  const isEditingPastMonth = editingId !== null && formDate && new Date(formDate) < new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const isFieldsLocked = false;
  
  // Helpers
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setJustSavedTransaction(null);
  }, []);
  
  const handleCreateSimilar = useCallback(() => {
    if (justSavedTransaction) {
      form.reset({
        kind: justSavedTransaction.kind,
        account_id: justSavedTransaction.account_id,
        category_id: justSavedTransaction.category_id,
        subcategory_id: justSavedTransaction.subcategory_id,
        amount: justSavedTransaction.amount,
        date: new Date(),
        description: justSavedTransaction.description,
        payment_method: justSavedTransaction.payment_method,
      });
      setEditingId(null);
      setIsDialogOpen(true);
      setTimeout(() => amountInputRef.current?.focus(), 100);
    }
  }, [justSavedTransaction, form]);

  // --- SETTERS ---
  const setFormDescription = useCallback((desc: string) => form.setValue('description', desc), [form]);
  const setFormAmount = useCallback((amount: number | undefined) => form.setValue('amount', amount), [form]);
  const setFormKind = useCallback((kind: TransactionKind) => form.setValue('kind', kind), [form]);
  const setFormAccountId = useCallback((id: string | undefined) => form.setValue('account_id', id || ''), [form]);
  const setFormToAccountId = useCallback((id: string | undefined) => form.setValue('to_account_id', id || null), [form]);
  const setFormCategoryId = useCallback((id: string | undefined) => form.setValue('category_id', id || null), [form]);
  const setFormSubcategoryId = useCallback((id: string | undefined) => form.setValue('subcategory_id', id || null), [form]);
  const setFormMemberId = useCallback((id: string | undefined) => form.setValue('member_id', id || null), [form]);
  const setFormPaymentMethod = useCallback((method: PaymentMethod) => form.setValue('payment_method', method), [form]);
  const setFormCreditCardId = useCallback((id: string | undefined) => form.setValue('credit_card_id', id || null), [form]);
  const setFormDate = useCallback((date: string) => {
    // Converte string YYYY-MM-DD para Date
    const dateObj = new Date(date + 'T12:00:00');
    form.setValue('date', dateObj);
  }, [form]);
  const setFormIsRecurring = useCallback((isRecurring: boolean) => form.setValue('is_recurring', isRecurring), [form]);
  const setFormInstallmentCount = useCallback((count: number) => form.setValue('installments_count', count), [form]);

  // --- EFEITOS (Somente Essenciais) ---

  // 1. Atualizar formIsPlanned baseado na data e is_recurring
  useEffect(() => {
    if (formDate) {
      const isFutureDate = new Date(formDate) > new Date();
      const isRecurring = formIsRecurring === true;
      setFormIsPlanned(isFutureDate || isRecurring);
    } else {
      setFormIsPlanned(false);
    }
  }, [formDate, formIsRecurring]);

  // 2. Resetar ao fechar dialog (se não estiver editando)
  useEffect(() => {
    if (!isDialogOpen) {
      // Pequeno delay para animação fechar
      const timer = setTimeout(() => {
        if (!editingId) {
          form.reset({
            kind: 'EXPENSE',
            date: new Date(),
            amount: '',
            description: '',
            payment_method: 'debit',
            account_id: preferences.lastAccountId || '',
          });
          setFormIsPlanned(false);
        }
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isDialogOpen, editingId, form, preferences.lastAccountId]);

  // --- AÇÕES ---

  const openNewDialog = useCallback(() => {
    setEditingId(null);
    form.reset({
      kind: 'EXPENSE',
      date: new Date(),
      amount: '',
      description: '',
      payment_method: 'debit',
      account_id: preferences.lastAccountId || '',
    });
    setIsDialogOpen(true);
    // Foca no valor após abrir
    setTimeout(() => amountInputRef.current?.focus(), 100);
  }, [form, preferences.lastAccountId]);

  const openEditDialog = useCallback((transaction: Transaction) => {
    setEditingId(transaction.id);
    form.reset({
      kind: transaction.kind,
      account_id: transaction.account_id,
      to_account_id: transaction.to_account_id,
      category_id: transaction.category_id,
      amount: transaction.amount,
      date: new Date(transaction.date), // Garante objeto Date
      description: transaction.description,
      payment_method: transaction.payment_method,
      credit_card_id: transaction.credit_card_id,
    });
    setIsDialogOpen(true);
  }, [form]);

  // --- SUBMIT CORE (A Mágica da Sanitização) ---

  const buildFormData = () => {
    const data = form.getValues();
    
    // SANITIZAÇÃO (Onde limpamos os dados antes de enviar)
    const cleanData = { ...data };

    // Regra: Se não é Despesa, remove coisas de cartão e categoria se quiser
    if (cleanData.kind !== 'EXPENSE') {
      cleanData.credit_card_id = null;
      // Para transferência, garantimos método null se o backend exigir, ou 'debit'
      if (cleanData.kind === 'TRANSFER') {
        cleanData.payment_method = null;
        cleanData.category_id = null;
        cleanData.subcategory_id = null;
      }
    }

    // Regra: Se método não é crédito, remove ID do cartão
    if (cleanData.payment_method !== 'credit') {
      cleanData.credit_card_id = null;
    }

    // Regra: Conversão de Amount
    const finalAmount = typeof cleanData.amount === 'string' 
      ? parseFloat(cleanData.amount.replace(/[^0-9,.-]+/g, '').replace(',', '.'))
      : Number(cleanData.amount);

    return {
      ...cleanData,
      amount: finalAmount
    };
  };

  const submitTransaction = async (): Promise<boolean> => {
    // 1. Trigger validação do form
    const isValid = await form.trigger();
    if (!isValid) {
      return false;
    }

    try {
      setIsSubmitting(true); // Bloqueia clique duplo
      const formData = buildFormData();

      // PAYLOAD COMPLETO - Todos os campos necessários para o RPC
      const payload = {
        p_household_id: householdId,
        p_account_id: formData.account_id,
        p_to_account_id: formData.to_account_id || null,
        p_category_id: formData.category_id || null,
        p_subcategory_id: formData.subcategory_id || null,
        p_amount: formData.amount,
        p_date: formData.date.toISOString().split('T')[0], // YYYY-MM-DD
        p_description: formData.description,
        p_kind: formData.kind,
        p_payment_method: formData.payment_method || null,
        p_credit_card_id: formData.credit_card_id || null,
        p_status: editingId ? undefined : (formIsPlanned ? 'planned' : 'confirmed'),
        p_user_id: user?.id || null
      };

      console.log("📤 Enviando Transação:", payload); // Debug

      const { error } = await (supabase.rpc as any)('create_transaction_secure', payload);

      if (error) {
        console.error("Erro RPC:", error);
        toast.error(`Erro ao salvar: ${error.message}`);
        return false;
      }

      toast.success("Transação salva com sucesso!");
      
      // Invalidar queries para atualizar a UI imediatamente
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['transactions'] }),
        queryClient.invalidateQueries({ queryKey: ['dashboard'] }),
        queryClient.invalidateQueries({ queryKey: ['accounts'] }),
        queryClient.invalidateQueries({ queryKey: ['credit-cards'] })
      ]);
      
      savePreferences({
        kind: formData.kind,
        accountId: formData.account_id,
        toAccountId: formData.to_account_id || undefined,
        categoryId: formData.category_id || undefined,
        subcategoryId: formData.subcategory_id || undefined
      });

      setJustSavedTransaction({
        ...formData,
        id: 'new',
      });
      setIsDialogOpen(false); // Fecha e reseta
      return true;

    } catch (err: any) {
      console.error("Crash no Submit:", err);
      toast.error("Erro inesperado ao salvar.");
      return false;
    } finally {
      setIsSubmitting(false); // Libera a UI
    }
  };

  return {
    form,
    amountInputRef,
    isDialogOpen,
    setIsDialogOpen,
    editingId,
    openNewDialog,
    openEditDialog,
    submitTransaction,
    isSubmitting,
    formIsPlanned,
    setFormIsPlanned,
    // Form values
    formKind,
    setFormKind,
    formAccountId,
    setFormAccountId,
    formToAccountId,
    setFormToAccountId,
    formCategoryId,
    setFormCategoryId,
    formSubcategoryId,
    setFormSubcategoryId,
    formAmount,
    setFormAmount,
    formDate: formDateString,
    setFormDate,
    formDescription,
    setFormDescription,
    formMemberId,
    setFormMemberId,
    formPaymentMethod,
    setFormPaymentMethod,
    formCreditCardId,
    setFormCreditCardId,
    formIsRecurring,
    setFormIsRecurring,
    formIsInstallment,
    setFormIsInstallment,
    formInstallmentCount,
    setFormInstallmentCount,
    formInstallmentDueDate,
    setFormInstallmentDueDate,
    formRecurringStartMonth,
    setFormRecurringStartMonth,
    formRecurringEndMonth,
    setFormRecurringEndMonth,
    formHasEndMonth,
    setFormHasEndMonth,
    formDayOfMonth,
    setFormDayOfMonth,
    // Flags
    isEditingConfirmed,
    isEditingPastMonth,
    isFieldsLocked,
    // Data
    selectableCategories,
    selectableSubcategories,
    budgetWarning,
    descriptionSuggestions,
    categorySuggestion,
    showCategorySuggestion: !!categorySuggestion,
    // Actions
    justSavedTransaction,
    handleCreateSimilar,
    closeDialog,
    openDuplicateDialog: openEditDialog, // Alias para duplicar (usa mesma lógica de edição)
  };
}