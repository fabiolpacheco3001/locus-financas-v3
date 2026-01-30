import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Account, AccountType } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format, startOfMonth } from 'date-fns';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

interface BalanceBreakdown {
  totalIncome: number;
  totalExpense: number;
  transfersIn: number;
  transfersOut: number;
  initialBalance: number;
}

interface AccountWithBalance extends Account {
  calculated_balance: number;
  transaction_count: number;
  saved_balance: number;
  breakdown: BalanceBreakdown;
}

/**
 * useAccounts - Refactored to use Database-First Architecture
 * 
 * Balance calculation is now done by Postgres functions (Single Source of Truth):
 * - get_accounts_with_balances(): Returns all accounts with calculated balances
 * - get_account_balance(account_id): Returns balance for a single account
 * - sync_all_account_balances(): Batch reconciliation
 * - force_update_account_balance(account_id): Sync single account
 * 
 * This eliminates client-side calculation and prevents race conditions.
 */
export function useAccounts() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  // ARCHITECTURE FIX: Use RPC to get balances calculated by Postgres
  const { data: accountsWithBalances = [], isLoading } = useQuery({
    queryKey: ['accounts', 'with-balances', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      
      // Call the database function that calculates balances (Single Source of Truth)
      const { data, error } = await supabase.rpc('get_accounts_with_balances');
      
      if (error) {
        console.error('[useAccounts] RPC get_accounts_with_balances failed:', error);
        throw error;
      }
      
      // Transform to expected format with breakdown (breakdown not available from RPC, use defaults)
      const result: AccountWithBalance[] = (data || []).map((account: {
        id: string;
        household_id: string;
        name: string;
        type: AccountType;
        initial_balance: number;
        current_balance: number;
        is_active: boolean;
        is_primary: boolean;
        is_reserve: boolean;
        created_at: string;
        updated_at: string;
        calculated_balance: number;
        transaction_count: number;
      }) => ({
        id: account.id,
        household_id: account.household_id,
        name: account.name,
        type: account.type,
        initial_balance: Number(account.initial_balance) || 0,
        current_balance: Number(account.current_balance) || 0,
        is_active: account.is_active,
        is_primary: account.is_primary,
        is_reserve: account.is_reserve,
        created_at: account.created_at,
        updated_at: account.updated_at,
        calculated_balance: Number(account.calculated_balance) || 0,
        transaction_count: Number(account.transaction_count) || 0,
        saved_balance: Number(account.current_balance) || 0,
        breakdown: {
          totalIncome: 0, // Not returned from RPC - would need separate call if needed
          totalExpense: 0,
          transfersIn: 0,
          transfersOut: 0,
          initialBalance: Number(account.initial_balance) || 0,
        },
      }));
      
      return result;
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 2, // 2 minutes - accounts balance changes frequently
    gcTime: 1000 * 60 * 10, // 10 minutes - keep in memory for quick access
  });

  const createAccount = useMutation({
    mutationFn: async (account: { name: string; type: AccountType; initial_balance?: number; initial_balance_date?: Date }) => {
      if (!householdId) throw new Error('No household');
      
      // Ensure initial_balance is a valid number
      const initialBalance = Number(account.initial_balance) || 0;
      
      // Debug: Log payload before insert
      const payload = {
        name: account.name,
        type: account.type,
        household_id: householdId,
        initial_balance: initialBalance,
      };
      console.log('Payload antes do insert:', payload);
      
      // Create the account first
      const { data: newAccount, error } = await supabase
        .from('accounts')
        .insert({ 
          name: account.name,
          type: account.type,
          household_id: householdId,
          initial_balance: initialBalance,
        })
        .select()
        .single();
      
      if (error) throw error;
      
      // If there's an initial balance, create an INCOME transaction
      if (initialBalance > 0) {
        const balanceDate = account.initial_balance_date || new Date();
        const firstDayOfMonth = format(startOfMonth(balanceDate), 'yyyy-MM-dd');
        
        const { error: transactionError } = await supabase
          .from('transactions')
          .insert({
            household_id: householdId,
            account_id: newAccount.id,
            kind: 'INCOME',
            amount: initialBalance,
            date: firstDayOfMonth,
            description: 'Saldo inicial',
          });
        
        if (transactionError) {
          // Rollback: delete the account if transaction creation fails
          await supabase.from('accounts').delete().eq('id', newAccount.id);
          throw transactionError;
        }
      }
      
      return newAccount;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      toast.success('Conta criada com sucesso!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const updateAccount = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Account> & { id: string }) => {
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      toast.success('Conta atualizada!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const setPrimaryAccount = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase
        .from('accounts')
        .update({ is_primary: true })
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      toast.success('Conta principal definida!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const deleteAccount = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      toast.success('Conta excluída!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // ARCHITECTURE FIX: Use RPC for batch reconciliation (Database-First)
  const reconcileBalances = useMutation({
    mutationFn: async () => {
      if (!householdId) throw new Error('No household');
      
      // Call the database function that syncs all balances
      const { data, error } = await supabase.rpc('sync_all_account_balances');
      
      if (error) {
        console.error('[reconcileBalances] RPC sync_all_account_balances failed:', error);
        throw error;
      }
      
      return data || [];
    },
    onSuccess: (report) => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      
      const adjustedCount = (report as Array<{ difference: number }>).filter(
        (r) => Math.abs(r.difference) > 0.001
      ).length;
      
      if (adjustedCount > 0) {
        toast.success(`Reconciliação concluída! ${adjustedCount} conta(s) ajustada(s).`);
      } else {
        toast.success('Reconciliação concluída! Todos os saldos já estavam corretos.');
      }
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // ARCHITECTURE FIX: Use RPC for single account sync (Database-First)
  const forceAccountSync = useMutation({
    mutationFn: async (accountId: string) => {
      if (!householdId) throw new Error('No household');
      
      
      
      // Get current balance for comparison (optional, for logging)
      const accountBefore = accountsWithBalances.find(a => a.id === accountId);
      const oldBalance = accountBefore?.saved_balance ?? 0;
      
      // Call the database function - it calculates and updates internally
      const { error } = await supabase.rpc('force_update_account_balance', {
        p_account_id: accountId,
        p_new_balance: null // null means: calculate using get_account_balance internally
      });
      
      if (error) {
        console.error('[ForceSync] RPC force_update_account_balance failed:', error);
        throw error;
      }
      
      // Get the new balance after sync
      const { data: newBalanceData, error: balanceError } = await supabase.rpc(
        'get_account_balance',
        { p_account_id: accountId }
      );
      
      if (balanceError) {
        console.warn('[ForceSync] Failed to fetch new balance after sync:', balanceError);
      }
      
      const newBalance = Number(newBalanceData) || 0;
      
      
      return { 
        accountName: accountBefore?.name || 'Conta', 
        oldBalance, 
        newBalance 
      };
    },
    onSuccess: (result) => {
      
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['transactions'] });
      queryClient.invalidateQueries({ queryKey: ['account-projections'] });
      
      toast.success(`Saldo de ${result.accountName} atualizado: R$ ${result.oldBalance.toFixed(2)} → R$ ${result.newBalance.toFixed(2)}`);
    },
    onError: (error) => {
      console.error('[ForceSync] Mutation error:', error);
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Helper to get balance for a specific account (uses cached data)
  const getAccountBalance = (accountId: string): number => {
    const account = accountsWithBalances.find(a => a.id === accountId);
    return account?.calculated_balance ?? 0;
  };

  const primaryAccount = accountsWithBalances.find(a => a.is_primary);

  return {
    accounts: accountsWithBalances,
    isLoading,
    createAccount,
    updateAccount,
    deleteAccount,
    setPrimaryAccount,
    reconcileBalances,
    forceAccountSync,
    getAccountBalance,
    bankAccounts: accountsWithBalances.filter(a => a.type === 'BANK'),
    cardAccounts: accountsWithBalances.filter(a => a.type === 'CARD'),
    cashAccounts: accountsWithBalances.filter(a => a.type === 'CASH'),
    totalBalance: accountsWithBalances.reduce((sum, a) => sum + a.calculated_balance, 0),
    primaryAccount,
  };
}
