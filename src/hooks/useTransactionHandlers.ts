import { useState, useCallback } from 'react';
import { useTransactions } from '@/hooks/useTransactions';
import { useInstallments } from '@/hooks/useInstallments';
import { useRecurringTransactions } from '@/hooks/useRecurringTransactions';
import { useGamification } from '@/hooks/useGamification';
import { Transaction, ExpenseType } from '@/types/finance';
import { useLocale } from '@/i18n/useLocale';
import { toast } from 'sonner';
import { InstallmentActionType } from '@/components/transactions/InstallmentActionDialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
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

interface Category {
  id: string;
  name: string;
  type?: 'income' | 'expense' | string;
}

interface UseTransactionHandlersProps {
  transactionForm: TransactionFormType;
  accounts: Account[];
  categories?: Category[];
  createTransaction: ReturnType<typeof useTransactions>['createTransaction'];
  updateTransaction: ReturnType<typeof useTransactions>['updateTransaction'];
  deleteTransaction: ReturnType<typeof useTransactions>['deleteTransaction'];
  confirmTransaction: ReturnType<typeof useTransactions>['confirmTransaction'];
}

export function useTransactionHandlers({
  transactionForm,
  accounts,
  categories = [],
  createTransaction,
  updateTransaction,
  deleteTransaction,
  confirmTransaction,
}: UseTransactionHandlersProps) {
  const { t, formatCurrency } = useLocale();
  const { householdId, member, user } = useAuth();
  const queryClient = useQueryClient();
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
    
    console.log('[Save Transaction] Iniciando salvamento:', {
      isNewTransaction,
      editingId: transactionForm.editingId,
      data,
    });
    
    try {
      if (transactionForm.editingId) {
        console.log('[Save Transaction] Atualizando transação existente...');
        const scope = (window as any).__installmentEditScope as 'single' | 'this_and_future' | undefined;
        const installmentData = (window as any).__installmentEditData as Transaction | undefined;
        
        console.log('[Save Transaction] Dados de parcela:', { scope, hasInstallmentGroup: !!installmentData?.installment_group_id });
        
        if (scope && installmentData?.installment_group_id) {
          console.log('[Save Transaction] Atualizando parcela(s)...');
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
          console.log('[Save Transaction] Parcela atualizada com sucesso');
        } else {
          console.log('[Save Transaction] Atualizando transação normal...');
          await updateTransaction.mutateAsync({ id: transactionForm.editingId, ...data });
          console.log('[Save Transaction] Transação atualizada com sucesso');
        }
        
        transactionForm.closeDialog();
      } else {
        console.log('[Save Transaction] Criando nova transação...');
        await createTransaction.mutateAsync(data);
        console.log('[Save Transaction] Transação criada com sucesso');
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
    } catch (error) {
      // Error already handled by mutation's onError, but log unexpected errors
      console.error('[Transaction Save Error]', error);
      // If it's not a mutation error, show a generic error message
      if (error && typeof error === 'object' && !('message' in error)) {
        toast.error('Erro ao salvar transação. Por favor, tente novamente.');
      }
    }
  }, [transactionForm, createTransaction, updateTransaction, updateInstallment, awardTransactionXp]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMutationPending) {
      console.warn('[Form Submit] Mutation já está em andamento, ignorando submit');
      return;
    }
    
    try {
      // buildFormData sempre retorna dados (validações removidas - banco vai dar erro se necessário)
      const data = transactionForm.buildFormData();
      console.log("⚡ [RPC] Iniciando envio seguro...", data);

      // 1. Sanitização Básica no Frontend
      const cleanPaymentMethod = data.kind === 'INCOME' ? null : data.payment_method;

      // 2. Chamada Direta à RPC (Ignora RLS e Household ID do front)
      const { data: rpcData, error: rpcError } = await (supabase.rpc as any)('create_transaction_secure', {
        p_account_id: data.account_id,
        p_category_id: data.category_id,
        p_amount: data.amount,
        p_date: data.date,
        p_description: data.description,
        p_kind: data.kind,
        p_payment_method: cleanPaymentMethod
      });

      if (rpcError) {
        console.error("❌ [RPC] Erro no Banco:", rpcError);
        toast.error(`Erro ao salvar: ${rpcError.message}`);
        throw rpcError;
      }

      console.log("✅ [RPC] Sucesso:", rpcData);
      toast.success("Transação salva com sucesso!");

      // 3. Reset e Fechamento
      transactionForm.form.reset();
      transactionForm.closeDialog();
      
      // Invalidar queries para atualizar a lista
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });

    } catch (error) {
      console.error("❌ Erro fatal no submit:", error);
    }
  }, [transactionForm, isMutationPending, queryClient]);

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
