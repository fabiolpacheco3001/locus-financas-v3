import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PendingInvite {
  id: string;
  householdId: string;
  role: string;
  expiresAt: string;
  createdAt: string;
}

/**
 * Hook to fetch and manage pending invites for the current user.
 * Uses the RPC `get_my_pending_invites` to securely fetch invites
 * addressed to the user's email.
 */
export function usePendingInvites() {
  const { user, householdId } = useAuth();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchInvites = useCallback(async () => {
    // Skip if user already has a household
    if (!user || householdId) {
      setInvites([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const { data, error: rpcError } = await supabase.rpc('get_my_pending_invites');

    if (rpcError) {
      console.error('Failed to fetch pending invites:', rpcError.message);
      setError(rpcError.message);
      setInvites([]);
    } else if (data) {
      setInvites(
        data.map((inv: { id: string; household_id: string; role: string; expires_at: string; created_at: string }) => ({
          id: inv.id,
          householdId: inv.household_id,
          role: inv.role,
          expiresAt: inv.expires_at,
          createdAt: inv.created_at,
        }))
      );
    } else {
      setInvites([]);
    }

    setLoading(false);
  }, [user, householdId]);

  useEffect(() => {
    fetchInvites();
  }, [fetchInvites]);

  const refetch = useCallback(() => {
    fetchInvites();
  }, [fetchInvites]);

  return { invites, loading, error, refetch };
}
