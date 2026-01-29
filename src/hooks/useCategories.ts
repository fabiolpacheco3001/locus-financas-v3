import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Category, Subcategory } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';
import { useLocale } from '@/i18n/useLocale';

export function useCategories() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLocale();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('categories')
        .select(`
          *,
          subcategories (*)
        `)
        .eq('household_id', householdId)
        .order('name');
      
      if (error) throw error;
      
      // Sort categories and subcategories alphabetically (A-Z)
      const sortedData = (data as Category[]).map(category => ({
        ...category,
        subcategories: category.subcategories?.sort((a, b) => 
          a.name.localeCompare(b.name, 'pt-BR')
        ) || []
      })).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      
      return sortedData;
    },
    enabled: !!householdId
  });

  // Filter active (non-archived) categories and subcategories
  const activeCategories = categories
    .filter(c => !c.archived_at)
    .map(c => ({
      ...c,
      subcategories: c.subcategories?.filter(s => !s.archived_at) || []
    }));

  // Filter archived categories (includes categories with archived_at set)
  const archivedCategories = categories.filter(c => c.archived_at);

  const createCategory = useMutation({
    mutationFn: async (category: { name: string; is_budget_excluded?: boolean; is_essential?: boolean }) => {
      if (!householdId) throw new Error('No household');
      const { data, error } = await supabase
        .from('categories')
        .insert({ ...category, household_id: householdId })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.created'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const updateCategory = useMutation({
    mutationFn: async ({ id, ...updates }: Partial<Category> & { id: string }) => {
      const { data, error } = await supabase
        .from('categories')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.updated'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Archive category (soft delete) - also archives all subcategories via trigger
  const archiveCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.archived'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Restore archived category
  const restoreCategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('categories')
        .update({ archived_at: null })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.restored'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  const createSubcategory = useMutation({
    mutationFn: async (subcategory: { category_id: string; name: string }) => {
      const { data, error } = await supabase
        .from('subcategories')
        .insert(subcategory)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.subcategoryCreated'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Archive subcategory (soft delete)
  const archiveSubcategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subcategories')
        .update({ archived_at: new Date().toISOString() })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.subcategoryArchived'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Restore archived subcategory
  const restoreSubcategory = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('subcategories')
        .update({ archived_at: null })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      toast.success(t('categories.messages.subcategoryRestored'));
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });


  return {
    // All categories (including archived)
    categories,
    // Only active categories (non-archived)
    activeCategories,
    // Only archived categories
    archivedCategories,
    isLoading,
    createCategory,
    updateCategory,
    archiveCategory,
    restoreCategory,
    createSubcategory,
    archiveSubcategory,
    restoreSubcategory,
    // Budget categories are active categories not excluded from budget
    budgetCategories: activeCategories.filter(c => !c.is_budget_excluded)
  };
}
