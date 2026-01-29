import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Member, MemberRole } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

export function useMembers() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  const { data: members = [], isLoading } = useQuery({
    queryKey: ['members', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      // Use secure RPC with household param - emails/user_id masked for non-admins
      const { data, error } = await supabase.rpc('get_members_visible', {
        p_household_id: householdId
      });
      
      if (error) throw error;
      return (data || []) as Member[];
    },
    enabled: !!householdId
  });

  const createMember = useMutation({
    mutationFn: async (member: { name: string; role?: MemberRole }) => {
      if (!householdId) throw new Error('No household');
      // Insert without .select() to avoid exposing data through RLS bypass
      // RLS policy "Admins can insert members" handles authorization
      const { error } = await supabase
        .from('members')
        .insert({ ...member, household_id: householdId, role: member.role || 'MEMBER' });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Membro adicionado!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const updateMember = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Member> & { id: string }) => {
      // Update without .select() to avoid exposing data
      // RLS policy "Admins can update members" handles authorization
      const { error } = await supabase
        .from('members')
        .update(updates)
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Membro atualizado!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('members')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['members'] });
      toast.success('Membro removido!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  return {
    members,
    isLoading,
    createMember,
    updateMember,
    deleteMember
  };
}
