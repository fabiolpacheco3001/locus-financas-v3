import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format, startOfMonth } from 'date-fns';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactionPreferences } from '@/hooks/useTransactionPreferences';
import { useBudgetValidation } from '@/hooks/useBudgetValidation';
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions';
import { useCategorySuggestion } from '@/hooks/useCategorySuggestion';
import { PaymentMethod, calculateInvoiceMonth, getInvoiceDueDate } from '@/types/creditCards';
import { TransactionKind, TransactionStatus, ExpenseType, Transaction } from '@/types/finance';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';
import { parseBrazilianCurrency } from '@/lib/utils/money';
import { supabase } from '@/integrations/supabase/client'; // <--- IMPORTANTE

// Schema Zod RELAXADO (Deixa o banco validar)
const transactionFormSchema = z.object({
  kind: z.enum(['EXPENSE', 'INCOME', 'TRANSFER']),
  account_id: z.string().min(1, 'Selecione uma conta'),
  to_account_id: z.string().nullable().optional(),
  category_id: z.string().nullable().optional(),
  subcategory_id: z.string().nullable().optional(),
  amount: z.preprocess(
    (val) => parseBrazilianCurrency(val as string | number | null | undefined),
    z.number().positive("O valor deve ser maior que zero")
  ),
  date: z.string(),
  description: z.string().nullable().optional(),
  member_id: z.string().nullable().optional(),
  status: z.string().optional(),
  expense_type: z.string().nullable().optional(),
  due_date: z.string().nullable().optional(),
  payment_method: z.string().nullable().optional(),
  credit_card_id: z.string().nullable().optional(),
  invoice_month: z.string().nullable().optional(),
  household_id: z.string().nullable().optional(),
});

export type TransactionFormValues = z.infer<typeof transactionFormSchema>;

// Interfaces (Mantidas originais)
interface Account { id: string; name: string; type?: string; }
interface Category { id: string; name: string; archived_at?: string | null; type?: 'income' | 'expense' | string; subcategories?: Subcategory[]; }
interface Subcategory { id: string; name: string; archived_at?: string | null; }
interface CreditCard { id: string; name: string; color: string; closing_day: number; due_day: number; }

interface UseTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  activeCategories: Category[];
  creditCards: CreditCard[];
  isLoadingAccounts?: boolean;
  refetchAccounts?: () => Promise<any>;
}

export interface TransactionFormData {
  kind: TransactionKind;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  subcategory_id: string | null;
  amount: number;
  date: string;
  description: string | null;
  member_id: string | null;
  status: TransactionStatus;
  expense_type: ExpenseType | null;
  due_date: string | null;
  payment_method: PaymentMethod | null;
  credit_card_id: string | null;
  invoice_month: string | null;
  household_id?: string;
}

export function useTransactionForm({
  accounts,
  categories,
  activeCategories,
  creditCards,
  isLoadingAccounts = false,
  refetchAccounts,
}: UseTransactionFormProps) {
  const { member, householdId } = useAuth();
  const { t } = useLocale();
  const queryClient = useQueryClient();
  const {
    lastKind, lastAccountId, lastCategoryId, lastSubcategoryId, 
    lastFromAccountId, lastToAccountId, savePreferences,
  } = useTransactionPreferences(member?.id);

  const amountInputRef = useRef<HTMLInputElement>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Estados extras
  const [isEditingConfirmed, setIsEditingConfirmed] = useState(false);
  const [isEditingPastMonth, setIsEditingPastMonth] = useState(false);
  const [formIsInstallment, setFormIsInstallment] = useState(false);
  const [formInstallmentCount, setFormInstallmentCount] = useState<number>(0);
  const [formInstallmentDueDate, setFormInstallmentDueDate] = useState<string>('');
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurringStartMonth, setFormRecurringStartMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [formRecurringEndMonth, setFormRecurringEndMonth] = useState<string>('');
  const [formHasEndMonth, setFormHasEndMonth] = useState(false);
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(new Date().getDate());
  const [justSavedTransaction, setJustSavedTransaction] = useState<TransactionFormData | null>(null);

  // Default Values
  const getDefaultValues = useCallback((): TransactionFormValues => {
    let defaultAccountId = '';
    if (accounts.length > 0) {
      if (accounts.length === 1) defaultAccountId = accounts[0].id;
      else if (lastAccountId && accounts.some(a => a.id === lastAccountId)) defaultAccountId = lastAccountId;
      else defaultAccountId = accounts[0].id;
    }
    
    return {
      kind: lastKind || 'EXPENSE',
      account_id: defaultAccountId,
      to_account_id: null,
      category_id: null,
      subcategory_id: null,
      amount: 0,
      date: format(new Date(), 'yyyy-MM-dd'),
      description: '',
      member_id: member?.id || null,
      status: 'confirmed',
      expense_type: null,
      due_date: null,
      payment_method: 'debit',
      credit_card_id: null,
      invoice_month: null,
    };
  }, [accounts, lastKind, lastAccountId, member?.id]);

  const form = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionFormSchema),
    defaultValues: getDefaultValues(),
    mode: 'onChange',
  });

  // Atualiza conta se lista mudar
  useEffect(() => {
    if (accounts.length > 0 && isDialogOpen && !editingId) {
      const currentAccountId = form.getValues('account_id');
      if (!currentAccountId || !accounts.some(a => a.id === currentAccountId)) {
        form.setValue('account_id', accounts[0].id);
      }
    }
  }, [accounts, isDialogOpen, editingId, form]);

  // Watchers
  const formKind = form.watch('kind');
  const formAccountId = form.watch('account_id');
  const formToAccountId = form.watch('to_account_id');
  const formCategoryId = form.watch('category_id');
  const formSubcategoryId = form.watch('subcategory_id');
  const formAmount = form.watch('amount');
  const formDate = form.watch('date');
  const formDescription = form.watch('description');
  const formMemberId = form.watch('member_id');
  const formIsPlanned = form.watch('status') === 'planned';
  const formPaymentMethod = form.watch('payment_method') as PaymentMethod;
  const formCreditCardId = form.watch('credit_card_id');

  // Setters
  const setFormKind = useCallback((kind: TransactionKind) => form.setValue('kind', kind), [form]);
  const setFormAccountId = useCallback((id: string | undefined) => form.setValue('account_id', id || ''), [form]);
  const setFormToAccountId = useCallback((id: string | undefined) => form.setValue('to_account_id', id || null), [form]);
  const setFormCategoryId = useCallback((id: string | undefined) => form.setValue('category_id', id || null), [form]);
  const setFormSubcategoryId = useCallback((id: string | undefined) => form.setValue('subcategory_id', id || null), [form]);
  const setFormAmount = useCallback((amount: number | undefined) => form.setValue('amount', amount || 0), [form]);
  const setFormDate = useCallback((date: string) => form.setValue('date', date), [form]);
  const setFormDescription = useCallback((desc: string) => form.setValue('description', desc || null), [form]);
  const setFormMemberId = useCallback((id: string | undefined) => form.setValue('member_id', id || null), [form]);
  const setFormIsPlanned = useCallback((planned: boolean) => form.setValue('status', planned ? 'planned' : 'confirmed'), [form]);
  const setFormPaymentMethod = useCallback((method: PaymentMethod) => form.setValue('payment_method', method), [form]);
  const setFormCreditCardId = useCallback((id: string | undefined) => form.setValue('credit_card_id', id || null), [form]);

  // Derived state
  const isFieldsLocked = false;
  const currentCategory = formCategoryId ? categories.find(c => c.id === formCategoryId) : undefined;
  
  const selectableCategories = useMemo(() => {
    if (currentCategory?.archived_at && currentCategory) return [...activeCategories, currentCategory];
    return activeCategories;
  }, [activeCategories, currentCategory]);

  const selectedCategory = categories.find(c => c.id === formCategoryId);
  const allSubcategories = selectedCategory?.subcategories || [];
  const currentSubcategory = formSubcategoryId ? allSubcategories.find(s => s.id === formSubcategoryId) : undefined;

  const selectableSubcategories = useMemo(() => {
    const activeSubcats = allSubcategories.filter(s => !s.archived_at);
    if (currentSubcategory?.archived_at && currentSubcategory) return [...activeSubcats, currentSubcategory];
    return activeSubcats;
  }, [allSubcategories, currentSubcategory]);

  // Validations & Suggestions
  const parsedAmount = useMemo(() => formAmount ?? 0, [formAmount]);
  const { warning: budgetWarning } = useBudgetValidation({
    categoryId: formCategoryId,
    subcategoryId: formSubcategoryId,
    amount: parsedAmount,
    competenceDate: formDate,
    kind: formKind,
    editingTransactionId: editingId,
  });

  const { suggestions: descriptionSuggestions } = useDescriptionSuggestions({
    memberId: formMemberId, accountId: formAccountId, categoryId: formCategoryId, searchTerm: formDescription,
  });

  const { suggestion: categorySuggestion } = useCategorySuggestion({
    description: formDescription || '', kind: formKind, memberId: formMemberId,
  });

  const showCategorySuggestion = !!(categorySuggestion && !formCategoryId && formKind !== 'TRANSFER' && formDescription?.trim().length >= 3);

  // Auto-select category logic
  useEffect(() => {
    if ((formKind === 'EXPENSE' || formKind === 'INCOME') && !formCategoryId && activeCategories.length > 0 && isDialogOpen && !editingId) {
      if (formKind === 'INCOME') {
        const incomeCategory = activeCategories.find(c => c.type === 'income');
        form.setValue('category_id', incomeCategory ? incomeCategory.id : activeCategories[0].id);
      } else {
        form.setValue('category_id', activeCategories[0].id);
      }
    }
  }, [formKind, formCategoryId, activeCategories, isDialogOpen, editingId, form]);

  // Build Form Data (Prepara o objeto)
  const buildFormData = useCallback((): TransactionFormData => {
    const values = form.getValues();
    const result = transactionFormSchema.safeParse(values);
    const validatedData = result.success ? result.data : values as any;

    let finalCategoryId = validatedData.category_id;
    if (validatedData.kind === 'INCOME' && !validatedData.category_id) {
      const defaultCategory = activeCategories.find(c => c.type === 'income')?.id || activeCategories[0]?.id;
      finalCategoryId = defaultCategory;
    }

    let status: TransactionStatus = 'confirmed';
    if (validatedData.kind === 'EXPENSE') {
        if (validatedData.payment_method === 'credit_card') status = 'confirmed';
        else if (validatedData.date > format(new Date(), 'yyyy-MM-dd') || validatedData.status === 'planned') status = 'planned';
    }

    // Sanitização do Payment Method (AQUI ESTÁ O SEGREDO)
    // Se for INCOME, força NULL, ignorando o que estiver no form visual
    const finalPaymentMethod = validatedData.kind === 'INCOME' ? null : validatedData.payment_method;

    return {
      kind: validatedData.kind,
      account_id: validatedData.account_id || '',
      to_account_id: validatedData.kind === 'TRANSFER' ? validatedData.to_account_id : null,
      category_id: finalCategoryId,
      subcategory_id: validatedData.subcategory_id,
      amount: validatedData.amount || 0,
      date: validatedData.date || format(new Date(), 'yyyy-MM-dd'),
      description: validatedData.description,
      member_id: validatedData.member_id,
      status,
      expense_type: validatedData.expense_type || (validatedData.kind === 'EXPENSE' ? 'variable' : null),
      due_date: null, // Simplificado
      payment_method: finalPaymentMethod, // <--- Aqui garantimos o null para receitas
      credit_card_id: validatedData.credit_card_id,
      invoice_month: null,
      household_id: undefined, // Banco preenche
    };
  }, [form, activeCategories]);

  const submitTransaction = async (): Promise<boolean> => {
    try {
      const formData = buildFormData();

      const { data, error } = await supabase.rpc('create_transaction_secure', {
        p_account_id: formData.account_id,
        p_category_id: formData.category_id,
        p_amount: formData.amount,
        p_date: formData.date,
        p_description: formData.description,
        p_kind: formData.kind,
        p_payment_method: formData.payment_method
      });

      if (error) {
        console.error("Erro ao salvar transação:", error);
        toast.error(`Erro ao salvar: ${error.message}`);
        return false;
      }

      toast.success("Transação salva com sucesso!");
      
      // FORÇA A ATUALIZAÇÃO DA LISTA E DO RESUMO
      await queryClient.invalidateQueries({ queryKey: ['transactions'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard'] }); // Garante resumo atualizado
      console.log("🔄 [HOOK] Lista de transações atualizada.");
      
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      
      savePreferences({
        kind: formData.kind,
        accountId: formData.account_id,
        categoryId: formData.category_id || undefined
      });

      return true;
    } catch (err: any) {
      console.error("Erro inesperado ao salvar transação:", err);
      toast.error("Erro inesperado ao salvar.");
      return false;
    }
  };

  // Funções auxiliares (Reset, Open, etc) - Mantidas simples para brevidade
  const resetForm = useCallback(() => { setEditingId(null); form.reset(getDefaultValues()); setJustSavedTransaction(null); }, [form, getDefaultValues]);
  const closeDialog = useCallback(() => { setIsDialogOpen(false); setJustSavedTransaction(null); resetForm(); }, [resetForm]);
  const openNewDialog = useCallback(() => { setEditingId(null); setIsDialogOpen(true); }, []);
  const openEditDialog = useCallback((tx: Transaction) => { setEditingId(tx.id); setIsDialogOpen(true); form.reset(tx as any); }, [form]);
  const openDuplicateDialog = useCallback((tx: Transaction) => { setEditingId(null); setIsDialogOpen(true); form.reset({ ...tx, id: undefined } as any); }, [form]);
  const handleCreateSimilar = useCallback(() => { if(justSavedTransaction) form.reset(justSavedTransaction); }, [justSavedTransaction, form]);
  const populateFormForInstallmentEdit = useCallback((tx: Transaction) => { setEditingId(tx.id); setIsDialogOpen(true); form.reset(tx as any); }, [form]);

  return {
    form, amountInputRef, isDialogOpen, setIsDialogOpen, editingId,
    formKind, setFormKind, formAccountId, setFormAccountId, formToAccountId, setFormToAccountId,
    formCategoryId, setFormCategoryId, formSubcategoryId, setFormSubcategoryId,
    formAmount, setFormAmount, formDate, setFormDate, formDescription, setFormDescription,
    formMemberId, setFormMemberId, formIsPlanned, setFormIsPlanned, formPaymentMethod, setFormPaymentMethod,
    formCreditCardId, setFormCreditCardId, isEditingConfirmed, isEditingPastMonth, isFieldsLocked,
    formIsInstallment, setFormIsInstallment, formInstallmentCount, setFormInstallmentCount, formInstallmentDueDate, setFormInstallmentDueDate,
    formIsRecurring, setFormIsRecurring, formRecurringStartMonth, setFormRecurringStartMonth, formRecurringEndMonth, setFormRecurringEndMonth,
    formHasEndMonth, setFormHasEndMonth, formDayOfMonth, setFormDayOfMonth,
    justSavedTransaction, setJustSavedTransaction,
    selectableCategories, selectableSubcategories,
    budgetWarning, descriptionSuggestions, categorySuggestion, showCategorySuggestion,
    savePreferences, resetForm, openNewDialog, openEditDialog, openDuplicateDialog,
    populateFormForInstallmentEdit, handleCreateSimilar, closeDialog, buildFormData,
    submitTransaction // <--- EXPORTADO AGORA!
  };
}