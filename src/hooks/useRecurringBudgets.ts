import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { RecurringBudget } from '@/types/finance';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { getFriendlyErrorMessage } from '@/lib/errorMessages';

interface CreateRecurringBudgetParams {
  category_id: string;
  subcategory_id?: string | null;
  amount: number;
  start_month: string; // YYYY-MM
  end_month?: string | null;
}

// Helper to parse YYYY-MM to year and month
function parseYearMonth(ym: string): { year: number; month: number } {
  const [year, month] = ym.split('-').map(Number);
  return { year, month };
}

// Helper to format year and month to YYYY-MM
function formatYearMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

// Helper to compare YYYY-MM strings
function compareYearMonth(a: string, b: string): number {
  const aDate = parseYearMonth(a);
  const bDate = parseYearMonth(b);
  if (aDate.year !== bDate.year) return aDate.year - bDate.year;
  return aDate.month - bDate.month;
}

// Generate all months between start and end (inclusive)
function generateMonthRange(start: string, end: string | null, maxMonths = 24): string[] {
  const months: string[] = [];
  const { year: startYear, month: startMonth } = parseYearMonth(start);
  
  let currentYear = startYear;
  let currentMonth = startMonth;
  
  // If no end, generate up to maxMonths ahead
  const endLimit = end || formatYearMonth(
    startYear + Math.floor((startMonth + maxMonths - 1) / 12),
    ((startMonth + maxMonths - 1) % 12) || 12
  );
  
  while (compareYearMonth(formatYearMonth(currentYear, currentMonth), endLimit) <= 0) {
    months.push(formatYearMonth(currentYear, currentMonth));
    currentMonth++;
    if (currentMonth > 12) {
      currentMonth = 1;
      currentYear++;
    }
    if (months.length >= maxMonths) break;
  }
  
  return months;
}

export function useRecurringBudgets() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  const { data: recurringBudgets = [], isLoading } = useQuery({
    queryKey: ['recurring-budgets', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      const { data, error } = await supabase
        .from('budgets_recurring')
        .select(`
          *,
          category:categories(*),
          subcategory:subcategories(*)
        `)
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as RecurringBudget[];
    },
    enabled: !!householdId
  });

  // Create a recurring budget and generate monthly budgets
  const createRecurringBudget = useMutation({
    mutationFn: async (params: CreateRecurringBudgetParams) => {
      if (!householdId) throw new Error('No household');
      
      // Create the recurring budget
      const { data: recurring, error: recurringError } = await supabase
        .from('budgets_recurring')
        .insert({
          household_id: householdId,
          category_id: params.category_id,
          subcategory_id: params.subcategory_id || null,
          amount: params.amount,
          frequency: 'monthly',
          start_month: params.start_month,
          end_month: params.end_month || null
        })
        .select()
        .single();
      
      if (recurringError) throw recurringError;
      
      // Generate monthly budgets
      const months = generateMonthRange(params.start_month, params.end_month);
      
      for (const monthStr of months) {
        const { year, month } = parseYearMonth(monthStr);
        
        // Check if budget already exists for this month
        let query = supabase
          .from('budgets')
          .select('id, is_manual')
          .eq('household_id', householdId)
          .eq('category_id', params.category_id)
          .eq('year', year)
          .eq('month', month);
        
        if (params.subcategory_id) {
          query = query.eq('subcategory_id', params.subcategory_id);
        } else {
          query = query.is('subcategory_id', null);
        }
        
        const { data: existingList } = await query;
        
        if (existingList && existingList.length > 0) {
          // Find the best budget to update (prefer non-manual, or the first one)
          const nonManual = existingList.find(b => !b.is_manual);
          const targetBudget = nonManual || existingList[0];
          
          // Always link to recurring, but only update amount if not manually edited
          const updateData: Record<string, unknown> = {
            recurring_budget_id: recurring.id,
            updated_at: new Date().toISOString()
          };
          
          if (!targetBudget.is_manual) {
            updateData.planned_amount = params.amount;
          }
          
          await supabase
            .from('budgets')
            .update(updateData)
            .eq('id', targetBudget.id);
        } else {
          // Create new budget
          await supabase
            .from('budgets')
            .insert({
              household_id: householdId,
              category_id: params.category_id,
              subcategory_id: params.subcategory_id || null,
              year,
              month,
              planned_amount: params.amount,
              recurring_budget_id: recurring.id,
              is_manual: false
            });
        }
      }
      
      return recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orçamento recorrente criado!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Update a recurring budget
  const updateRecurringBudget = useMutation({
    mutationFn: async (params: { id: string } & Partial<CreateRecurringBudgetParams>) => {
      if (!householdId) throw new Error('No household');
      
      const { data: recurring, error } = await supabase
        .from('budgets_recurring')
        .update({
          amount: params.amount,
          end_month: params.end_month,
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)
        .select()
        .single();
      
      if (error) throw error;
      
      // Update future non-manual budgets
      if (params.amount !== undefined) {
        const currentDate = new Date();
        const currentYM = formatYearMonth(currentDate.getFullYear(), currentDate.getMonth() + 1);
        
        // Get all budgets linked to this recurring budget
        const { data: linkedBudgets } = await supabase
          .from('budgets')
          .select('id, year, month, is_manual')
          .eq('recurring_budget_id', params.id);
        
        if (linkedBudgets) {
          for (const budget of linkedBudgets) {
            const budgetYM = formatYearMonth(budget.year, budget.month);
            // Only update future or current month non-manual budgets
            if (compareYearMonth(budgetYM, currentYM) >= 0 && !budget.is_manual) {
              await supabase
                .from('budgets')
                .update({ 
                  planned_amount: params.amount,
                  updated_at: new Date().toISOString()
                })
                .eq('id', budget.id);
            }
          }
        }
      }
      
      return recurring;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Orçamento recorrente atualizado!');
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Delete a recurring budget with cleanup
  const deleteRecurringBudget = useMutation({
    mutationFn: async ({ id, fromMonth }: { id: string; fromMonth: string }) => {
      const { error } = await supabase.rpc('delete_recurring_budget_and_cleanup', {
        p_recurring_id: id,
        p_from_month: fromMonth
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['recurring-budgets'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
    },
    onError: (error) => {
      toast.error(getFriendlyErrorMessage(error));
    }
  });

  // Check if a category/subcategory has a recurring budget
  const getRecurringBudgetFor = (categoryId: string, subcategoryId?: string | null): RecurringBudget | undefined => {
    return recurringBudgets.find(rb => {
      if (subcategoryId) {
        return rb.subcategory_id === subcategoryId;
      }
      return rb.category_id === categoryId && !rb.subcategory_id;
    });
  };

  // Generate budgets for a specific month (called when navigating to a new month)
  const ensureBudgetsForMonth = async (year: number, month: number) => {
    if (!householdId) return;
    
    const targetYM = formatYearMonth(year, month);
    
    for (const recurring of recurringBudgets) {
      // Check if month is within range
      if (compareYearMonth(targetYM, recurring.start_month) < 0) continue;
      if (recurring.end_month && compareYearMonth(targetYM, recurring.end_month) > 0) continue;
      
      // Check if budget already exists
      let query = supabase
        .from('budgets')
        .select('id, is_manual, recurring_budget_id')
        .eq('household_id', householdId)
        .eq('category_id', recurring.category_id)
        .eq('year', year)
        .eq('month', month);
      
      if (recurring.subcategory_id) {
        query = query.eq('subcategory_id', recurring.subcategory_id);
      } else {
        query = query.is('subcategory_id', null);
      }
      
      const { data: existingList } = await query;
      
      if (!existingList || existingList.length === 0) {
        // No existing budget - create new one
        await supabase
          .from('budgets')
          .insert({
            household_id: householdId,
            category_id: recurring.category_id,
            subcategory_id: recurring.subcategory_id,
            year,
            month,
            planned_amount: recurring.amount,
            recurring_budget_id: recurring.id,
            is_manual: false
          });
      } else {
        // Check if any existing budget is already linked to this recurring
        const alreadyLinked = existingList.some(b => b.recurring_budget_id === recurring.id);
        
        if (!alreadyLinked) {
          // Link the best candidate (prefer non-manual)
          const nonManual = existingList.find(b => !b.is_manual && !b.recurring_budget_id);
          const unlinked = existingList.find(b => !b.recurring_budget_id);
          const targetBudget = nonManual || unlinked;
          
          if (targetBudget) {
            const updateData: Record<string, unknown> = {
              recurring_budget_id: recurring.id,
              updated_at: new Date().toISOString()
            };
            
            if (!targetBudget.is_manual) {
              updateData.planned_amount = recurring.amount;
            }
            
            await supabase
              .from('budgets')
              .update(updateData)
              .eq('id', targetBudget.id);
          }
        }
      }
    }
    
    // Invalidate budgets query to refresh
    queryClient.invalidateQueries({ queryKey: ['budgets', householdId, year, month] });
  };

  return {
    recurringBudgets,
    isLoading,
    createRecurringBudget,
    updateRecurringBudget,
    deleteRecurringBudget,
    getRecurringBudgetFor,
    ensureBudgetsForMonth
  };
}
