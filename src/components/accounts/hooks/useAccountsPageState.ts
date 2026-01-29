import { useState, useCallback } from 'react';
import type { AccountType } from '@/types/finance';
import type { AccountWithBalance } from '../AccountCard';

export function useAccountsPageState() {
  // Form dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  // Form fields
  const [formName, setFormName] = useState('');
  const [formType, setFormType] = useState<AccountType>('BANK');
  const [formBalance, setFormBalance] = useState('');
  const [formInitialBalance, setFormInitialBalance] = useState('');
  const [formIsReserve, setFormIsReserve] = useState(false);
  
  // Detail dialog state
  const [detailAccountId, setDetailAccountId] = useState<string | null>(null);

  // Reset form to initial state
  const resetForm = useCallback(() => {
    setEditingId(null);
    setFormName('');
    setFormType('BANK');
    setFormBalance('');
    setFormInitialBalance('');
    setFormIsReserve(false);
  }, []);

  // Open new account dialog
  const openNewDialog = useCallback(() => {
    resetForm();
    setIsDialogOpen(true);
  }, [resetForm]);

  // Open edit dialog with account data
  const openEditDialog = useCallback((account: AccountWithBalance) => {
    setEditingId(account.id);
    setFormName(account.name);
    setFormType(account.type);
    setFormBalance('');
    setFormInitialBalance(String(account.initial_balance || 0).replace('.', ','));
    setFormIsReserve(account.is_reserve || false);
    setIsDialogOpen(true);
  }, []);

  // Close form dialog
  const closeDialog = useCallback(() => {
    setIsDialogOpen(false);
    resetForm();
  }, [resetForm]);

  // Open detail dialog
  const openDetailDialog = useCallback((id: string) => {
    setDetailAccountId(id);
  }, []);

  // Close detail dialog
  const closeDetailDialog = useCallback(() => {
    setDetailAccountId(null);
  }, []);

  return {
    // Form dialog
    isDialogOpen,
    setIsDialogOpen,
    editingId,
    openNewDialog,
    openEditDialog,
    closeDialog,

    // Form fields
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

    // Detail dialog
    detailAccountId,
    openDetailDialog,
    closeDetailDialog,
  };
}
