import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface RecurrencePattern {
  description: string;
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  averageAmount: number;
  occurrences: number;
  months: string[]; // YYYY-MM format
}

interface UseRecurrenceDetectionProps {
  description: string;
  categoryId?: string;
  subcategoryId?: string | null;
  amount: number;
  enabled?: boolean;
}

export function useRecurrenceDetection({
  description,
  categoryId,
  amount,
  enabled = true,
}: UseRecurrenceDetectionProps) {
  const { householdId } = useAuth();

  const { data: pattern } = useQuery({
    queryKey: ['recurrence-detection', householdId, description, categoryId],
    queryFn: async (): Promise<RecurrencePattern | null> => {
      if (!householdId || !description?.trim() || !categoryId) return null;

      const trimmedDesc = description.trim().toLowerCase();

      // Fetch transactions from the last 6 months with matching description and category
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
      const startDate = sixMonthsAgo.toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('transactions')
        .select(`
          id,
          description,
          amount,
          date,
          category_id,
          subcategory_id,
          category:categories(id, name),
          subcategory:subcategories(id, name)
        `)
        .eq('household_id', householdId)
        .eq('category_id', categoryId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .gte('date', startDate)
        .order('date', { ascending: false });

      if (error || !data) return null;

      // Filter by similar description (case-insensitive exact match or very similar)
      const matchingTransactions = data.filter(t => {
        const tDesc = t.description?.trim().toLowerCase() || '';
        return tDesc === trimmedDesc || 
          (tDesc.length > 3 && trimmedDesc.length > 3 && 
           (tDesc.includes(trimmedDesc) || trimmedDesc.includes(tDesc)));
      });

      if (matchingTransactions.length < 2) return null;

      // Group by month (YYYY-MM)
      const monthsSet = new Set<string>();
      let totalAmount = 0;

      matchingTransactions.forEach(t => {
        const month = t.date.substring(0, 7); // YYYY-MM
        monthsSet.add(month);
        totalAmount += Number(t.amount);
      });

      const months = Array.from(monthsSet).sort().reverse();

      // Need at least 2 different months
      if (months.length < 2) return null;

      const averageAmount = totalAmount / matchingTransactions.length;

      // Check if current amount is within +/- 15% of average
      const lowerBound = averageAmount * 0.85;
      const upperBound = averageAmount * 1.15;

      if (amount < lowerBound || amount > upperBound) return null;

      // Found a recurring pattern!
      const firstMatch = matchingTransactions[0];
      
      return {
        description: description.trim(),
        categoryId,
        categoryName: (firstMatch.category as any)?.name || '',
        subcategoryId: firstMatch.subcategory_id,
        subcategoryName: (firstMatch.subcategory as any)?.name || null,
        averageAmount,
        occurrences: matchingTransactions.length,
        months,
      };
    },
    enabled: enabled && !!householdId && !!description?.trim() && !!categoryId && amount > 0,
    staleTime: 1000 * 60, // Cache for 1 minute
  });

  return { pattern };
}
