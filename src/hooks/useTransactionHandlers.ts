import { useState, useCallback } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useInstallments } from '@/hooks/useInstallments';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { useGamification } from '@/hooks/useGamification';
import { Transaction, ExpenseType } from '@/types/finance';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';
import { InstallmentActionType } from '@/components/transactions/InstallmentActionDialog';
interface Account {
  id: string;
  name: string;
  type?: string;
}

interface TransactionFormType {
  editingId: string | null;
  formKind: string;
  formAccountId: string | undefined;
  formToAccountId: string | undefined;
  formCategoryId: string | undefined;
  formSubcategoryId: string | undefined;
  formMemberId: string | undefined;
  formDescription: string;
  formExpenseType: string;
  formDayOfMonth: number;
  formRecurringStartMonth: string;
  formRecurringEndMonth: string;
  formHasEndMonth: boolean;
  formIsInstallment: boolean;
  formInstallmentCount: number;
  formInstallmentDueDate: string;
  formIsRecurring: boolean;
  buildFormData: () => any | null;
  savePreferences: (prefs: any) => void;
  closeDialog: () => void;
  setJustSavedTransaction: (data: any) => void;
  openEditDialog: (tx: Transaction) => void;
  populateFormForInstallmentEdit: (tx: Transaction) => void;
}

interface UseTransactionHandlersProps {
  transactionForm: TransactionFormType;
  accounts: Account[];
  createTransaction: ReturnType<typeof useTransactions>['createTransaction'];
  updateTransaction: ReturnType<typeof useTransactions>['updateTransaction'];
  deleteTransaction: ReturnType<typeof useTransactions>['deleteTransaction'];
  confirmTransaction: ReturnType<typeof useTransactions>['confirmTransaction'];
}

export function useTransactionHandlers({
  transactionForm,
  accounts,
  createTransaction,
  updateTransaction,
  deleteTransaction,
  confirmTransaction,
}: UseTransactionHandlersProps) {
  const { t, formatCurrency } = useLocale();
  const { createInstallments, updateInstallment, deleteInstallment } = useInstallments();
  const { createRecurringTransaction } = useRecurringTransactions();
  const { awardTransactionXp, awardConfirmationXp } = useGamification();

  // Confirmation dialog state
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [pendingTransactionData, setPendingTransactionData] = useState<any>(null);

  // Recurrence suggestion state
  const [showRecurrenceSuggestion, setShowRecurrenceSuggestion] = useState(false);
  const [lastSavedTransaction, setLastSavedTransaction] = useState<any>(null);

  // Installment action dialog state
  const [installmentActionDialogOpen, setInstallmentActionDialogOpen] = useState(false);
  const [installmentActionType, setInstallmentActionType] = useState<InstallmentActionType>('edit');
  const [pendingInstallmentAction, setPendingInstallmentAction] = useState<Transaction | null>(null);

  // Check if any mutation is pending
  const isMutationPending = createTransaction.isPending || 
    updateTransaction.isPending || 
    createRecurringTransaction.isPending || 
    createInstallments.isPending;

  const handleOpenEditDialog = useCallback((tx: Transaction) => {
    if (tx.installment_group_id && tx.installment_number && tx.installment_total) {
      setPendingInstallmentAction(tx);
      setInstallmentActionType('edit');
      setInstallmentActionDialogOpen(true);
      return;
    }
    
    transactionForm.openEditDialog(tx);
  }, [transactionForm]);

  const handleInstallmentEditScope = useCallback((scope: 'single' | 'this_and_future') => {
    if (!pendingInstallmentAction) return;
    
    const tx = pendingInstallmentAction;
    transactionForm.populateFormForInstallmentEdit(tx);
    
    (window as any).__installmentEditScope = scope;
    (window as any).__installmentEditData = tx;
    
    setPendingInstallmentAction(null);
  }, [pendingInstallmentAction, transactionForm]);

  const saveTransaction = useCallback(async (data: any) => {
    const isNewTransaction = !transactionForm.editingId;
    
    try {
      if (transactionForm.editingId) {
        const scope = (window as any).__installmentEditScope as 'single' | 'this_and_future' | undefined;
        const installmentData = (window as any).__installmentEditData as Transaction | undefined;
        
        if (scope && installmentData?.installment_group_id) {
          await updateInstallment.mutateAsync({
            id: transactionForm.editingId,
            scope,
            updates: {
              category_id: data.category_id,
              subcategory_id: data.subcategory_id,
              member_id: data.member_id,
              description: data.description,
              amount: data.amount,
            },
          });
          
          delete (window as any).__installmentEditScope;
          delete (window as any).__installmentEditData;
        } else {
          await updateTransaction.mutateAsync({ id: transactionForm.editingId, ...data });
        }
        
        transactionForm.closeDialog();
      } else {
        await createTransaction.mutateAsync(data);
        transactionForm.savePreferences({
          kind: data.kind,
          accountId: data.account_id,
          toAccountId: data.to_account_id,
          categoryId: data.category_id,
          subcategoryId: data.subcategory_id,
        });
        transactionForm.setJustSavedTransaction(data);
        awardTransactionXp();
      }
      
      setPendingTransactionData(null);
      
      // Check for recurrence pattern on new EXPENSE transactions
      if (isNewTransaction && data.kind === 'EXPENSE' && data.category_id && data.description) {
        setLastSavedTransaction(data);
        setTimeout(() => {
          setShowRecurrenceSuggestion(true);
        }, 500);
      }
    } catch {
      // Error already handled by mutation's onError
    }
  }, [transactionForm, createTransaction, updateTransaction, updateInstallment, awardTransactionXp]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMutationPending) return;
    
    const data = transactionForm.buildFormData();
    if (!data) {
      return;
    }
    
    // Handle installment creation for new transactions on credit cards
    const selectedAccount = accounts.find(a => a.id === transactionForm.formAccountId);
    const isCardExpense = transactionForm.formKind === 'EXPENSE' && selectedAccount?.type === 'CARD';
    
    if (isCardExpense && transactionForm.formIsInstallment && !transactionForm.editingId) {
      if (transactionForm.formInstallmentCount < 2 || transactionForm.formInstallmentCount > 24) {
        toast.error(t('transactions.messages.installmentRange'));
        return;
      }
      if (!transactionForm.formInstallmentDueDate) {
        toast.error(t('transactions.messages.enterFirstDueDate'));
        return;
      }
      if (!transactionForm.formCategoryId) {
        toast.error(t('transactions.messages.selectCategory'));
        return;
      }
      
      try {
        await createInstallments.mutateAsync({
          account_id: transactionForm.formAccountId!,
          category_id: transactionForm.formCategoryId!,
          subcategory_id: transactionForm.formSubcategoryId,
          member_id: transactionForm.formMemberId,
          total_amount: data.amount,
          installment_count: transactionForm.formInstallmentCount,
          due_date: transactionForm.formInstallmentDueDate,
          description: transactionForm.formDescription,
        });
        
        transactionForm.savePreferences({
          kind: transactionForm.formKind,
          accountId: transactionForm.formAccountId,
          categoryId: transactionForm.formCategoryId,
          subcategoryId: transactionForm.formSubcategoryId,
        });
        
        transactionForm.closeDialog();
      } catch {
        // Error already handled by mutation's onError
      }
      return;
    }
    
    // Handle recurring transaction creation
    if (transactionForm.formIsRecurring && !transactionForm.editingId) {
      try {
        await createRecurringTransaction.mutateAsync({
          kind: transactionForm.formKind as any,
          amount: data.amount,
          description: transactionForm.formDescription || null,
          account_id: transactionForm.formAccountId!,
          to_account_id: transactionForm.formKind === 'TRANSFER' ? transactionForm.formToAccountId : null,
          category_id: transactionForm.formKind === 'EXPENSE' ? (transactionForm.formCategoryId || null) : null,
          subcategory_id: transactionForm.formKind === 'EXPENSE' ? (transactionForm.formSubcategoryId || null) : null,
          member_id: transactionForm.formMemberId || null,
          expense_type: null, // Let DB infer from category.is_essential
          day_of_month: transactionForm.formDayOfMonth,
          start_month: transactionForm.formRecurringStartMonth,
          end_month: transactionForm.formHasEndMonth ? transactionForm.formRecurringEndMonth : null,
        });
        
        transactionForm.savePreferences({
          kind: transactionForm.formKind,
          accountId: transactionForm.formAccountId,
          toAccountId: transactionForm.formKind === 'TRANSFER' ? transactionForm.formToAccountId : undefined,
          categoryId: transactionForm.formCategoryId,
          subcategoryId: transactionForm.formSubcategoryId,
        });
        
        awardTransactionXp();
        transactionForm.closeDialog();
      } catch {
        // Error already handled by mutation's onError
      }
      return;
    }

    // Check if confirmation is needed (amount > 1000 or TRANSFER)
    if (data.amount > 1000 || transactionForm.formKind === 'TRANSFER') {
      setPendingTransactionData(data);
      setIsConfirmDialogOpen(true);
      return;
    }

    await saveTransaction(data);
  }, [isMutationPending, transactionForm, accounts, createInstallments, createRecurringTransaction, awardTransactionXp, saveTransaction, t]);

  const handleConfirmSave = useCallback(async () => {
    if (pendingTransactionData) {
      await saveTransaction(pendingTransactionData);
    }
    setIsConfirmDialogOpen(false);
  }, [pendingTransactionData, saveTransaction]);

  const handleDelete = useCallback(async (tx: Transaction) => {
    if (tx.installment_group_id && tx.installment_number && tx.installment_total) {
      setPendingInstallmentAction(tx);
      setInstallmentActionType('delete');
      setInstallmentActionDialogOpen(true);
      return;
    }
    
    if (confirm(t('transactions.messages.deleteConfirm'))) {
      try {
        await deleteTransaction.mutateAsync(tx.id);
      } catch {
        // Error already handled by mutation's onError
      }
    }
  }, [deleteTransaction, t]);

  const handleInstallmentDeleteScope = useCallback(async (scope: 'single' | 'this_and_future') => {
    if (!pendingInstallmentAction) return;
    
    try {
      await deleteInstallment.mutateAsync({
        id: pendingInstallmentAction.id,
        installment_group_id: pendingInstallmentAction.installment_group_id!,
        installment_number: pendingInstallmentAction.installment_number!,
        scope,
      });
      
      setPendingInstallmentAction(null);
    } catch {
      // Error already handled by mutation's onError
    }
  }, [pendingInstallmentAction, deleteInstallment]);

  const handleConfirm = useCallback(async (tx: Transaction) => {
    try {
      await confirmTransaction.mutateAsync(tx.id);
      awardConfirmationXp();
    } catch {
      // Error already handled by mutation's onError
    }
  }, [confirmTransaction, awardConfirmationXp]);

  const getConfirmationMessage = useCallback((categories: Array<{ id: string; name: string }>) => {
    if (!pendingTransactionData) return '';
    
    const amount = formatCurrency(pendingTransactionData.amount);
    const account = accounts.find(a => a.id === pendingTransactionData.account_id);
    
    if (pendingTransactionData.kind === 'TRANSFER') {
      const toAccount = accounts.find(a => a.id === pendingTransactionData.to_account_id);
      return t('transactions.confirmDialog.transferMessage', { 
        amount, 
        fromAccount: account?.name || t('transactions.account'), 
        toAccount: toAccount?.name || t('transactions.account') 
      });
    }
    
    const category = categories.find(c => c.id === pendingTransactionData.category_id);
    const action = pendingTransactionData.kind === 'INCOME' ? t('transactions.confirmDialog.receiving') : t('transactions.confirmDialog.posting');
    
    return t('transactions.confirmDialog.message', { 
      action, 
      amount, 
      category: category?.name || t('transactions.category'), 
      account: account?.name || t('transactions.account') 
    });
  }, [pendingTransactionData, accounts, formatCurrency, t]);

  const clearRecurrenceSuggestion = useCallback(() => {
    setShowRecurrenceSuggestion(false);
    setLastSavedTransaction(null);
  }, []);

  return {
    // Mutation state
    isMutationPending,

    // Confirmation dialog
    isConfirmDialogOpen,
    setIsConfirmDialogOpen,
    pendingTransactionData,
    setPendingTransactionData,
    handleConfirmSave,
    getConfirmationMessage,

    // Recurrence suggestion
    showRecurrenceSuggestion,
    lastSavedTransaction,
    clearRecurrenceSuggestion,

    // Installment action
    installmentActionDialogOpen,
    setInstallmentActionDialogOpen,
    installmentActionType,
    pendingInstallmentAction,
    handleInstallmentEditScope,
    handleInstallmentDeleteScope,

    // Core handlers
    handleSubmit,
    handleOpenEditDialog,
    handleDelete,
    handleConfirm,
  };
}
