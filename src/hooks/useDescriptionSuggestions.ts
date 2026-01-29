import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface UseDescriptionSuggestionsProps {
  memberId?: string;
  accountId?: string;
  categoryId?: string;
  searchTerm: string;
}

export function useDescriptionSuggestions({
  memberId,
  accountId,
  categoryId,
  searchTerm,
}: UseDescriptionSuggestionsProps) {
  const { householdId } = useAuth();

  // Fetch all transactions with descriptions for this household
  const { data: transactions = [] } = useQuery({
    queryKey: ['transaction-descriptions', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      
      const { data, error } = await supabase
        .from('transactions')
        .select('description, member_id, account_id, category_id, created_at')
        .eq('household_id', householdId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .not('description', 'is', null)
        .neq('description', '')
        .order('created_at', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data;
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const suggestions = useMemo(() => {
    if (!searchTerm || searchTerm.length < 2) return [];

    const searchLower = searchTerm.toLowerCase();
    
    // Get unique descriptions with scoring
    const descriptionScores = new Map<string, number>();
    
    transactions.forEach(t => {
      const desc = t.description?.trim();
      if (!desc || !desc.toLowerCase().includes(searchLower)) return;
      
      // Calculate priority score
      let score = 0;
      
      // Same member: +3 points
      if (memberId && t.member_id === memberId) score += 3;
      
      // Same account: +2 points
      if (accountId && t.account_id === accountId) score += 2;
      
      // Same category: +2 points
      if (categoryId && t.category_id === categoryId) score += 2;
      
      // Starts with search term: +1 point
      if (desc.toLowerCase().startsWith(searchLower)) score += 1;
      
      // Update score if higher
      const currentScore = descriptionScores.get(desc) || 0;
      if (score > currentScore) {
        descriptionScores.set(desc, score);
      }
    });

    // Sort by score (descending) and return top 5
    return Array.from(descriptionScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([desc]) => desc);
  }, [transactions, searchTerm, memberId, accountId, categoryId]);

  return { suggestions };
}
