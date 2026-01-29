import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { useAccounts } from '@/hooks/useAccounts';
import { useLocale } from '@/i18n/useLocale';
import { Plus, Wallet, RefreshCw, Loader2 } from 'lucide-react';

// Feature components
import { AccountsList } from '@/components/accounts/AccountsList';
import { AccountFormDialog } from '@/components/accounts/AccountFormDialog';
import { AccountDetailDialog } from '@/components/accounts/AccountDetailDialog';
import { useAccountsPageState } from '@/components/accounts/hooks/useAccountsPageState';
import type { AccountWithBalance } from '@/components/accounts/AccountCard';

export default function AccountsPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  
  const {
    accounts,
    isLoading,
    createAccount,
    updateAccount,
    deleteAccount,
    setPrimaryAccount,
    reconcileBalances,
    forceAccountSync,
    bankAccounts,
    cashAccounts,
  } = useAccounts();

  const {
    isDialogOpen,
    setIsDialogOpen,
    editingId,
    openNewDialog,
    openEditDialog,
    closeDialog,
    formName,
    setFormName,
    formType,
    setFormType,
    formBalance,
    setFormBalance,
    formInitialBalance,
    setFormInitialBalance,
    formIsReserve,
    setFormIsReserve,
    resetForm,
    detailAccountId,
    openDetailDialog,
    closeDetailDialog,
  } = useAccountsPageState();

  // Auth guards
  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  // Find detail account
  const detailAccount = detailAccountId 
    ? (accounts.find(a => a.id === detailAccountId) as AccountWithBalance | undefined) 
    : null;

  // Handlers
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        const newInitialBalance = parseFloat(formInitialBalance.replace(',', '.')) || 0;
        await updateAccount.mutateAsync({ 
          id: editingId, 
          name: formName,
          type: formType,
          is_reserve: formIsReserve,
          initial_balance: newInitialBalance,
        } as Parameters<typeof updateAccount.mutateAsync>[0]);
      } else {
        await createAccount.mutateAsync({
          name: formName,
          type: formType,
          initial_balance: parseFloat(formBalance.replace(',', '.')) || 0,
          initial_balance_date: new Date(),
        });
      }
      
      closeDialog();
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const handleDelete = async (id: string) => {
    if (confirm(t('accounts.messages.deleteConfirm'))) {
      try {
        await deleteAccount.mutateAsync(id);
      } catch {
        // Error already handled
      }
    }
  };

  const handleSetPrimary = async (id: string) => {
    try {
      await setPrimaryAccount.mutateAsync(id);
    } catch {
      // Error already handled
    }
  };

  const handleSync = (id: string) => {
    forceAccountSync.mutate(id);
  };

  return (
    <AppLayout>
      <PageHeader
        title={t('accounts.title')}
        description={t('accounts.description')}
        actions={
          // Mobile: Hide all header buttons (user relies on Bottom FAB)
          // Desktop: Show full action buttons
          <div className="hidden sm:flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => reconcileBalances.mutate()}
              disabled={reconcileBalances.isPending}
              title={t('accounts.reconcileTooltip')}
            >
              {reconcileBalances.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              {t('accounts.reconcile')}
            </Button>
            <Button onClick={openNewDialog} data-testid="btn-create-account">
              <Plus className="mr-2 h-4 w-4" />
              {t('accounts.new')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : accounts.length === 0 ? (
        <EmptyState
          icon={Wallet}
          title={t('accounts.empty.title')}
          description={t('accounts.empty.description')}
          actionLabel={t('accounts.new')}
          onAction={openNewDialog}
        />
      ) : (
        <AccountsList
          bankAccounts={bankAccounts as AccountWithBalance[]}
          cashAccounts={cashAccounts as AccountWithBalance[]}
          onViewDetails={openDetailDialog}
          onEdit={(account) => openEditDialog(account)}
          onDelete={handleDelete}
          onSetPrimary={handleSetPrimary}
        />
      )}

      {/* Account Form Dialog */}
      <AccountFormDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        editingId={editingId}
        formName={formName}
        formType={formType}
        formBalance={formBalance}
        formInitialBalance={formInitialBalance}
        formIsReserve={formIsReserve}
        onFormNameChange={setFormName}
        onFormTypeChange={setFormType}
        onFormBalanceChange={setFormBalance}
        onFormInitialBalanceChange={setFormInitialBalance}
        onFormIsReserveChange={setFormIsReserve}
        onSubmit={handleSubmit}
        isPending={createAccount.isPending || updateAccount.isPending}
      />

      {/* Account Detail Dialog */}
      <AccountDetailDialog
        open={!!detailAccountId}
        onOpenChange={(open) => !open && closeDetailDialog()}
        account={detailAccount || null}
        onSync={handleSync}
        isSyncing={forceAccountSync.isPending}
      />
    </AppLayout>
  );
}
