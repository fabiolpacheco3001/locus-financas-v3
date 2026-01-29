/**
 * useOpenFinanceConsent - Hook for managing Open Finance consent flow
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { useLocale } from '@/i18n/useLocale';
import type { 
  Bank, 
  ConsentPermission, 
  ConsentState, 
  OpenFinanceConnection,
  DEFAULT_PERMISSIONS 
} from '@/types/openFinance';
import { MOCK_BANKS } from '@/types/openFinance';

// ============================================
// INITIAL STATE
// ============================================

const initialState: ConsentState = {
  step: 1,
  selectedBank: null,
  permissions: ['ACCOUNTS_READ', 'BALANCES_READ', 'TRANSACTIONS_READ'],
  privacyAccepted: false,
  notificationsEnabled: true,
  isLoading: false,
  error: null,
};

// ============================================
// HOOK
// ============================================

export function useOpenFinanceConsent() {
  const { householdId } = useAuth();
  const { t } = useLocale();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [state, setState] = useState<ConsentState>(initialState);

  // ============================================
  // QUERIES
  // ============================================

  // Fetch existing connections
  const { data: connections = [], isLoading: isLoadingConnections } = useQuery({
    queryKey: ['open-finance-connections', householdId],
    queryFn: async () => {
      if (!householdId) return [];

      const { data, error } = await supabase
        .from('open_finance_connections')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching connections:', error);
        return [];
      }

      return data as OpenFinanceConnection[];
    },
    enabled: !!householdId,
  });

  // Get available banks (mock)
  const availableBanks = MOCK_BANKS;

  // ============================================
  // MUTATIONS
  // ============================================

  // Create connection
  const createConnectionMutation = useMutation({
    mutationFn: async (bank: Bank) => {
      if (!householdId) throw new Error('No household');

      // Mock external connection ID (in real impl, this comes from Pluggy/Belvo)
      const externalConnectionId = `mock_${bank.id}_${Date.now()}`;

      const { data, error } = await supabase
        .from('open_finance_connections')
        .insert({
          household_id: householdId,
          bank_id: bank.id,
          bank_name: bank.name,
          bank_logo: bank.logo,
          status: 'pending',
          permissions: state.permissions,
          privacy_accepted: state.privacyAccepted,
          notifications_enabled: state.notificationsEnabled,
          external_connection_id: externalConnectionId,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-finance-connections'] });
      setState(prev => ({ ...prev, step: 'success', isLoading: false }));
      toast({
        title: t('openFinance.toast.connectionCreated'),
        description: t('openFinance.toast.awaitingAuthorization'),
      });
    },
    onError: (error) => {
      console.error('Error creating connection:', error);
      setState(prev => ({ 
        ...prev, 
        step: 'error', 
        isLoading: false,
        error: error.message 
      }));
      toast({
        variant: 'destructive',
        title: t('openFinance.toast.error'),
        description: error.message,
      });
    },
  });

  // Revoke connection
  const revokeConnectionMutation = useMutation({
    mutationFn: async (connectionId: string) => {
      const { error } = await supabase
        .from('open_finance_connections')
        .update({ status: 'revoked' })
        .eq('id', connectionId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['open-finance-connections'] });
      toast({
        title: t('openFinance.toast.connectionRevoked'),
      });
    },
    onError: (error) => {
      toast({
        variant: 'destructive',
        title: t('openFinance.toast.error'),
        description: error.message,
      });
    },
  });

  // ============================================
  // ACTIONS
  // ============================================

  const nextStep = useCallback(() => {
    setState(prev => {
      if (prev.step === 1) return { ...prev, step: 2 };
      if (prev.step === 2) return { ...prev, step: 3 };
      return prev;
    });
  }, []);

  const prevStep = useCallback(() => {
    setState(prev => {
      if (prev.step === 2) return { ...prev, step: 1 };
      if (prev.step === 3) return { ...prev, step: 2 };
      return prev;
    });
  }, []);

  const selectBank = useCallback((bank: Bank) => {
    setState(prev => ({ ...prev, selectedBank: bank }));
  }, []);

  const togglePermission = useCallback((permission: ConsentPermission) => {
    setState(prev => {
      const hasPermission = prev.permissions.includes(permission);
      const newPermissions = hasPermission
        ? prev.permissions.filter(p => p !== permission)
        : [...prev.permissions, permission];
      return { ...prev, permissions: newPermissions };
    });
  }, []);

  const setPrivacyAccepted = useCallback((accepted: boolean) => {
    setState(prev => ({ ...prev, privacyAccepted: accepted }));
  }, []);

  const setNotificationsEnabled = useCallback((enabled: boolean) => {
    setState(prev => ({ ...prev, notificationsEnabled: enabled }));
  }, []);

  const submitConsent = useCallback(async () => {
    if (!state.selectedBank) return;
    
    setState(prev => ({ ...prev, isLoading: true }));
    
    // Simulate redirect to bank (in real impl, this would open bank's OAuth page)
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Create the connection
    await createConnectionMutation.mutateAsync(state.selectedBank);
  }, [state.selectedBank, createConnectionMutation]);

  const reset = useCallback(() => {
    setState(initialState);
  }, []);

  const revokeConnection = useCallback((connectionId: string) => {
    revokeConnectionMutation.mutate(connectionId);
  }, [revokeConnectionMutation]);

  // ============================================
  // RETURN
  // ============================================

  return {
    // State
    state,
    connections,
    availableBanks,
    isLoadingConnections,
    
    // Actions
    nextStep,
    prevStep,
    selectBank,
    togglePermission,
    setPrivacyAccepted,
    setNotificationsEnabled,
    submitConsent,
    reset,
    revokeConnection,
    
    // Computed
    hasActiveConnection: connections.some(c => c.status === 'active'),
    activeConnections: connections.filter(c => c.status === 'active'),
  };
}
