import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Budget } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

export function useBudgets(year: number, month: number) {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  const { data: budgets = [], isLoading } = useQuery({
    queryKey: ['budgets', householdId, year, month],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('budgets')
        .select(`
          *,
          category:categories(*),
          subcategory:subcategories(*)
        `)
        .eq('household_id', householdId)
        .eq('year', year)
        .eq('month', month);
      
      if (error) throw error;
      return data as Budget[];
    },
    enabled: !!householdId
  });

  const upsertBudget = useMutation({
    mutationFn: async (budget: {
      category_id: string;
      subcategory_id?: string | null;
      planned_amount: number;
    }) => {
      if (!householdId) throw new Error('No household');
      
      // First, try to find existing budget
      let query = supabase
        .from('budgets')
        .select('id')
        .eq('household_id', householdId)
        .eq('category_id', budget.category_id)
        .eq('year', year)
        .eq('month', month);
      
      // Handle subcategory_id: null means category-level budget
      if (budget.subcategory_id) {
        query = query.eq('subcategory_id', budget.subcategory_id);
      } else {
        query = query.is('subcategory_id', null);
      }
      
      const { data: existing } = await query.maybeSingle();
      
      if (existing) {
        // Update existing - mark as manual since user is editing
        const { data, error } = await supabase
          .from('budgets')
          .update({
            planned_amount: budget.planned_amount,
            is_manual: true, // Mark as manually edited
            updated_at: new Date().toISOString()
          })
          .eq('id', existing.id)
          .select()
          .single();
        
        if (error) throw error;
        return data;
      } else {
        // Insert new - mark as manual since user is creating
        const { data, error } = await supabase
          .from('budgets')
          .insert({
            household_id: householdId,
            category_id: budget.category_id,
            subcategory_id: budget.subcategory_id || null,
            year,
            month,
            planned_amount: budget.planned_amount,
            is_manual: true
          })
          .select()
          .single();
        
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orçamento salvo!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const deleteBudget = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orçamento excluído!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  return {
    budgets,
    isLoading,
    upsertBudget,
    deleteBudget
  };
}
