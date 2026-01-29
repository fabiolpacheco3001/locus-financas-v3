import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { format, startOfMonth } from 'date-fns';
import { useAuth } from '@/contexts/AuthContext';
import { useTransactionPreferences } from '@/hooks/useTransactionPreferences';
import { useBudgetValidation } from '@/hooks/useBudgetValidation';
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions';
import { useCategorySuggestion } from '@/hooks/useCategorySuggestion';
import { PaymentMethod, calculateInvoiceMonth, getInvoiceDueDate } from '@/types/creditCards';
import { TransactionKind, TransactionStatus, ExpenseType, Transaction } from '@/types/finance';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';

interface Account {
  id: string;
  name: string;
  type?: string;
}

interface Category {
  id: string;
  name: string;
  archived_at?: string | null;
  subcategories?: Subcategory[];
}

interface Subcategory {
  id: string;
  name: string;
  archived_at?: string | null;
}

interface CreditCard {
  id: string;
  name: string;
  color: string;
  closing_day: number;
  due_day: number;
}

interface UseTransactionFormProps {
  accounts: Account[];
  categories: Category[];
  activeCategories: Category[];
  creditCards: CreditCard[];
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
  payment_method: PaymentMethod;
  credit_card_id: string | null;
  invoice_month: string | null;
}

export function useTransactionForm({
  accounts,
  categories,
  activeCategories,
  creditCards,
}: UseTransactionFormProps) {
  const { member } = useAuth();
  const { t } = useLocale();
  const {
    lastKind,
    lastAccountId,
    lastCategoryId,
    lastSubcategoryId,
    lastFromAccountId,
    lastToAccountId,
    savePreferences,
  } = useTransactionPreferences(member?.id);

  // Ref for auto-focus on amount field
  const amountInputRef = useRef<HTMLInputElement>(null);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Core form fields
  const [formKind, setFormKind] = useState<TransactionKind>('EXPENSE');
  const [formAccountId, setFormAccountId] = useState<string | undefined>(undefined);
  const [formToAccountId, setFormToAccountId] = useState<string | undefined>(undefined);
  const [formCategoryId, setFormCategoryId] = useState<string | undefined>(undefined);
  const [formSubcategoryId, setFormSubcategoryId] = useState<string | undefined>(undefined);
  const [formAmount, setFormAmount] = useState<number | undefined>(undefined);
  const [formDate, setFormDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [formDescription, setFormDescription] = useState('');
  const [formMemberId, setFormMemberId] = useState<string | undefined>(undefined);

  // Status and type fields
  const [formIsPlanned, setFormIsPlanned] = useState(false);
  // formDueDate removed: Single Date Source rule - due_date is auto-calculated from formDate
  const [isEditingConfirmed, setIsEditingConfirmed] = useState(false);
  const [isEditingPastMonth, setIsEditingPastMonth] = useState(false);

  // Installment state
  const [formIsInstallment, setFormIsInstallment] = useState(false);
  const [formInstallmentCount, setFormInstallmentCount] = useState<number>(0);
  const [formInstallmentDueDate, setFormInstallmentDueDate] = useState<string>('');

  // Recurring transaction state
  const [formIsRecurring, setFormIsRecurring] = useState(false);
  const [formRecurringStartMonth, setFormRecurringStartMonth] = useState<string>(format(new Date(), 'yyyy-MM'));
  const [formRecurringEndMonth, setFormRecurringEndMonth] = useState<string>('');
  const [formHasEndMonth, setFormHasEndMonth] = useState(false);
  const [formDayOfMonth, setFormDayOfMonth] = useState<number>(new Date().getDate());

  // Payment method and credit card state
  const [formPaymentMethod, setFormPaymentMethod] = useState<PaymentMethod>('debit');
  const [formCreditCardId, setFormCreditCardId] = useState<string | undefined>(undefined);

  // Post-save state
  const [justSavedTransaction, setJustSavedTransaction] = useState<TransactionFormData | null>(null);

  // Combined immutability check
  // FIX #2: Only lock kind change for confirmed/past-month edits - allow editing amount, date, description
  const isKindLocked = isEditingConfirmed || isEditingPastMonth;
  // For legacy compatibility, expose as isFieldsLocked but we'll use it only for kind tabs
  const isFieldsLocked = false; // Allow editing of all fields

  // For form selects: use active categories, but include the current selection if archived (for editing)
  const currentCategory = formCategoryId ? categories.find(c => c.id === formCategoryId) : undefined;
  const currentCategoryIsArchived = currentCategory?.archived_at != null;

  const selectableCategories = useMemo(() => {
    const active = activeCategories;
    if (currentCategoryIsArchived && currentCategory) {
      return [...active, currentCategory];
    }
    return active;
  }, [activeCategories, currentCategory, currentCategoryIsArchived]);

  // Get subcategories from the selected category
  const selectedCategory = categories.find(c => c.id === formCategoryId);
  const allSubcategories = selectedCategory?.subcategories || [];

  const currentSubcategory = formSubcategoryId ? allSubcategories.find(s => s.id === formSubcategoryId) : undefined;
  const currentSubcategoryIsArchived = currentSubcategory?.archived_at != null;

  const selectableSubcategories = useMemo(() => {
    const activeSubcats = allSubcategories.filter(s => !s.archived_at);
    if (currentSubcategoryIsArchived && currentSubcategory) {
      return [...activeSubcats, currentSubcategory];
    }
    return activeSubcats;
  }, [allSubcategories, currentSubcategory, currentSubcategoryIsArchived]);

  // Parse amount for budget validation
  const parsedAmount = useMemo(() => {
    return formAmount ?? 0;
  }, [formAmount]);

  // Budget validation warning - always use formDate (Single Date Source)
  const competenceDateForBudget = formDate;

  const { warning: budgetWarning } = useBudgetValidation({
    categoryId: formCategoryId,
    subcategoryId: formSubcategoryId,
    amount: parsedAmount,
    competenceDate: competenceDateForBudget,
    kind: formKind,
    editingTransactionId: editingId,
  });

  // Description suggestions
  const { suggestions: descriptionSuggestions } = useDescriptionSuggestions({
    memberId: formMemberId,
    accountId: formAccountId,
    categoryId: formCategoryId,
    searchTerm: formDescription,
  });

  // Category suggestion based on description
  const { suggestion: categorySuggestion } = useCategorySuggestion({
    description: formDescription,
    kind: formKind,
    memberId: formMemberId,
  });

  // Show category suggestion only if category is not yet selected
  const showCategorySuggestion = categorySuggestion &&
    !formCategoryId &&
    formKind !== 'TRANSFER' &&
    formDescription.trim().length >= 3;

  // Auto-focus on amount field when dialog opens for new transaction
  useEffect(() => {
    if (isDialogOpen && !editingId) {
      const timer = setTimeout(() => {
        amountInputRef.current?.focus();
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isDialogOpen, editingId]);

  // Helper to check if a transaction is from a past month
  const isFromPastMonth = useCallback((transaction: Transaction): boolean => {
    const now = new Date();
    const currentMonthStart = startOfMonth(now);
    const transactionDate = new Date(transaction.date + 'T12:00:00');
    return transactionDate < currentMonthStart;
  }, []);

  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormKind('EXPENSE');
    setFormAccountId(undefined);
    setFormToAccountId(undefined);
    setFormCategoryId(undefined);
    setFormSubcategoryId(undefined);
    setFormAmount(undefined);
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDescription('');
    setFormMemberId(member?.id);
    setFormIsPlanned(false);
    setFormIsInstallment(false);
    setFormInstallmentCount(0);
    setFormInstallmentDueDate('');
    setFormIsRecurring(false);
    setFormRecurringStartMonth(format(new Date(), 'yyyy-MM'));
    setFormRecurringEndMonth('');
    setFormHasEndMonth(false);
    setFormDayOfMonth(new Date().getDate());
    setIsEditingConfirmed(false);
    setIsEditingPastMonth(false);
    setFormPaymentMethod('debit');
    setFormCreditCardId(undefined);
    setJustSavedTransaction(null);
  }, [member?.id]);

  const openNewDialog = useCallback(() => {
    setEditingId(null);
    setFormKind(lastKind);
    setFormIsPlanned(false);
    
    setFormIsInstallment(false);
    setFormInstallmentCount(0);
    setFormInstallmentDueDate('');
    setFormIsRecurring(false);
    setFormRecurringStartMonth(format(new Date(), 'yyyy-MM'));
    setFormRecurringEndMonth('');
    setFormHasEndMonth(false);
    setFormDayOfMonth(new Date().getDate());
    setIsEditingConfirmed(false);
    setIsEditingPastMonth(false);
    setFormPaymentMethod('debit');
    setFormCreditCardId(undefined);
    setJustSavedTransaction(null);

    if (lastKind === 'TRANSFER') {
      const validFromAccount = lastFromAccountId && accounts.some(a => a.id === lastFromAccountId);
      const validToAccount = lastToAccountId && accounts.some(a => a.id === lastToAccountId);
      setFormAccountId(validFromAccount ? lastFromAccountId : undefined);
      setFormToAccountId(validToAccount ? lastToAccountId : undefined);
      setFormCategoryId(undefined);
      setFormSubcategoryId(undefined);
    } else if (lastKind === 'EXPENSE') {
      const validAccount = lastAccountId && accounts.some(a => a.id === lastAccountId);
      const validCategory = lastCategoryId && categories.some(c => c.id === lastCategoryId);
      const validSubcategory = lastSubcategoryId && categories
        .find(c => c.id === lastCategoryId)?.subcategories
        ?.some(s => s.id === lastSubcategoryId);

      setFormAccountId(validAccount ? lastAccountId : undefined);
      setFormToAccountId(undefined);
      setFormCategoryId(validCategory ? lastCategoryId : undefined);
      setFormSubcategoryId(validSubcategory ? lastSubcategoryId : undefined);
    } else {
      const validAccount = lastAccountId && accounts.some(a => a.id === lastAccountId);
      setFormAccountId(validAccount ? lastAccountId : undefined);
      setFormToAccountId(undefined);
      setFormCategoryId(undefined);
      setFormSubcategoryId(undefined);
    }

    setFormAmount(undefined);
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDescription('');
    setFormMemberId(member?.id);
    setIsDialogOpen(true);
  }, [lastKind, lastAccountId, lastCategoryId, lastSubcategoryId, lastFromAccountId, lastToAccountId, accounts, categories, member?.id]);

  const openEditDialog = useCallback((tx: Transaction) => {
    const isPastMonth = isFromPastMonth(tx);

    setEditingId(tx.id);
    setFormKind(tx.kind);
    setFormAccountId(tx.account_id);
    setFormToAccountId(tx.to_account_id ?? undefined);
    setFormCategoryId(tx.category_id ?? undefined);
    setFormSubcategoryId(tx.subcategory_id ?? undefined);
    setFormAmount(Number(tx.amount));
    setFormDate(tx.date);
    setFormDescription(tx.description || '');
    setFormMemberId(tx.member_id ?? undefined);
    setFormIsPlanned(tx.status === 'planned');
    setFormIsInstallment(false);
    setFormInstallmentCount(0);
    setFormInstallmentDueDate('');
    setFormIsRecurring(false);
    setIsEditingConfirmed(tx.status === 'confirmed');
    setIsEditingPastMonth(isPastMonth);
    setFormPaymentMethod((tx.payment_method as PaymentMethod) || 'debit');
    setFormCreditCardId(tx.credit_card_id ?? undefined);
    setJustSavedTransaction(null);
    setIsDialogOpen(true);
  }, [isFromPastMonth]);

  const openDuplicateDialog = useCallback((tx: Transaction) => {
    setEditingId(null);
    setFormKind(tx.kind);
    setFormAccountId(tx.account_id);
    setFormToAccountId(tx.to_account_id ?? undefined);
    setFormCategoryId(tx.category_id ?? undefined);
    setFormSubcategoryId(tx.subcategory_id ?? undefined);
    setFormAmount(Number(tx.amount));
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormDescription(tx.description || '');
    setFormMemberId(tx.member_id ?? undefined);
    setFormIsPlanned(tx.status === 'planned');
    setFormIsInstallment(false);
    setFormInstallmentCount(0);
    setFormInstallmentDueDate('');
    setFormIsRecurring(false);
    setIsEditingConfirmed(false);
    setIsEditingPastMonth(false);
    setFormPaymentMethod((tx.payment_method as PaymentMethod) || 'debit');
    setFormCreditCardId(tx.credit_card_id ?? undefined);
    setJustSavedTransaction(null);
    setIsDialogOpen(true);
  }, []);

  const populateFormForInstallmentEdit = useCallback((tx: Transaction) => {
    setEditingId(tx.id);
    setFormKind(tx.kind);
    setFormAccountId(tx.account_id);
    setFormToAccountId(tx.to_account_id ?? undefined);
    setFormCategoryId(tx.category_id ?? undefined);
    setFormSubcategoryId(tx.subcategory_id ?? undefined);
    setFormAmount(Number(tx.amount));
    setFormDate(tx.date);
    setFormDescription(tx.description || '');
    setFormMemberId(tx.member_id ?? undefined);
    setFormIsPlanned(tx.status === 'planned');
    
    setFormIsInstallment(false);
    setFormInstallmentCount(0);
    setFormPaymentMethod((tx.payment_method as PaymentMethod) || 'debit');
    setFormCreditCardId(tx.credit_card_id ?? undefined);
    setIsDialogOpen(true);
  }, []);

  const handleCreateSimilar = useCallback(() => {
    if (!justSavedTransaction) return;

    const tx = justSavedTransaction;

    setEditingId(null);
    setFormKind(tx.kind);
    setFormAccountId(tx.account_id);
    setFormToAccountId(tx.to_account_id ?? undefined);

    if (tx.kind === 'EXPENSE') {
      setFormCategoryId(tx.category_id ?? undefined);
      setFormSubcategoryId(tx.subcategory_id ?? undefined);
    } else {
      setFormCategoryId(undefined);
      setFormSubcategoryId(undefined);
    }

    setFormAmount(undefined);
    setFormDescription('');
    setFormDate(format(new Date(), 'yyyy-MM-dd'));
    setFormMemberId(tx.member_id ?? undefined);
    setJustSavedTransaction(null);

    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 100);
  }, [justSavedTransaction]);

  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    setJustSavedTransaction(null);
    resetForm();
  }, [resetForm]);

  // Build form data for submission
  const buildFormData = useCallback((): TransactionFormData | null => {
    // Validate required: account
    if (!formAccountId) {
      toast.error(t('transactions.form.selectAccount'));
      return null;
    }
    
    // Validate amount (must be positive number)
    const amount = formAmount ?? 0;
    if (amount <= 0) {
      toast.error(t('transactions.form.enterAmount'));
      return null;
    }

    // Validate required fields for EXPENSE
    if (formKind === 'EXPENSE') {
      if (!formCategoryId) {
        toast.error(t('transactions.messages.selectCategory'));
        return null;
      }
      if (selectableSubcategories.length > 0 && !formSubcategoryId) {
        toast.error(t('transactions.messages.selectSubcategory'));
        return null;
      }
      // Boleto: due_date is auto-calculated from formDate (no manual input needed)
      if (formPaymentMethod === 'credit_card' && !formCreditCardId) {
        toast.error(t('creditCards.selectCard'));
        return null;
      }
    }
    
    // Validate TRANSFER
    if (formKind === 'TRANSFER' && !formToAccountId) {
      toast.error(t('transactions.form.selectDestAccount'));
      return null;
    }

    // FIX #3 and #4: Smart status logic based on date and payment method
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isFutureDate = formDate > todayStr;
    
    let status: TransactionStatus = 'confirmed';
    
    // For credit card: always confirmed (purchase is made immediately)
    // For other methods: if future date, automatically set to planned
    if (formKind === 'EXPENSE') {
      if (formPaymentMethod === 'credit_card') {
        // Credit card purchases are always confirmed (the purchase happened)
        status = 'confirmed';
      } else if (isFutureDate || formIsPlanned) {
        // Future dates or explicit planned toggle = planned
        status = 'planned';
      }
    } else if (formKind === 'INCOME') {
      // INCOME: Always confirmed/received immediately (MVP decision)
      status = 'confirmed';
    }
    // TRANSFER: always confirmed (happens immediately)

    // Calculate invoice_month and due_date for credit card transactions
    let invoiceMonth: string | null = null;
    let calculatedDueDate: string = formDate; // Default: same as purchase date
    
    if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card' && formCreditCardId) {
      const selectedCard = creditCards.find(c => c.id === formCreditCardId);
      if (selectedCard) {
        invoiceMonth = calculateInvoiceMonth(new Date(formDate + 'T12:00:00'), selectedCard.closing_day);
        // Calculate the actual due date (cash flow date) for the credit card invoice
        const dueDateObj = getInvoiceDueDate(invoiceMonth, selectedCard.due_day);
        calculatedDueDate = format(dueDateObj, 'yyyy-MM-dd');
      }
    }
    // For boleto and other payment methods (debit, pix, cash), due_date = date (Single Date Source)
    // For other payment methods (debit, pix, cash), due_date = date (immediate)

    return {
      kind: formKind,
      account_id: formAccountId,
      to_account_id: formKind === 'TRANSFER' ? (formToAccountId || null) : null,
      category_id: formKind === 'EXPENSE' ? (formCategoryId || null) : null,
      subcategory_id: formKind === 'EXPENSE' ? (formSubcategoryId || null) : null,
      amount,
      date: formDate,
      description: formDescription || null,
      member_id: formMemberId || null,
      status,
      expense_type: null, // No longer used - will be inferred from category.is_essential
      due_date: calculatedDueDate,
      payment_method: formKind === 'EXPENSE' ? formPaymentMethod : 'debit',
      credit_card_id: formKind === 'EXPENSE' && formPaymentMethod === 'credit_card' ? (formCreditCardId || null) : null,
      invoice_month: invoiceMonth,
    };
  }, [
    formAccountId, formKind, formCategoryId, formSubcategoryId, formAmount, formDate,
    formDescription, formMemberId, formIsPlanned,
    formPaymentMethod, formCreditCardId, formToAccountId, selectableSubcategories,
    creditCards, t,
  ]);

  return {
    // Refs
    amountInputRef,

    // Dialog state
    isDialogOpen,
    setIsDialogOpen,
    editingId,

    // Core form fields
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
    formDate,
    setFormDate,
    formDescription,
    setFormDescription,
    formMemberId,
    setFormMemberId,

    // Status and type fields
    formIsPlanned,
    setFormIsPlanned,
    isEditingConfirmed,
    isEditingPastMonth,
    isFieldsLocked,

    // Installment state
    formIsInstallment,
    setFormIsInstallment,
    formInstallmentCount,
    setFormInstallmentCount,
    formInstallmentDueDate,
    setFormInstallmentDueDate,

    // Recurring state
    formIsRecurring,
    setFormIsRecurring,
    formRecurringStartMonth,
    setFormRecurringStartMonth,
    formRecurringEndMonth,
    setFormRecurringEndMonth,
    formHasEndMonth,
    setFormHasEndMonth,
    formDayOfMonth,
    setFormDayOfMonth,

    // Payment method state
    formPaymentMethod,
    setFormPaymentMethod,
    formCreditCardId,
    setFormCreditCardId,

    // Post-save state
    justSavedTransaction,
    setJustSavedTransaction,

    // Category/Subcategory selection helpers
    selectableCategories,
    selectableSubcategories,

    // Validation and suggestions
    budgetWarning,
    descriptionSuggestions,
    categorySuggestion,
    showCategorySuggestion,

    // Preferences
    savePreferences,

    // Actions
    resetForm,
    openNewDialog,
    openEditDialog,
    openDuplicateDialog,
    populateFormForInstallmentEdit,
    handleCreateSimilar,
    closeDialog,
    buildFormData,
  };
}
