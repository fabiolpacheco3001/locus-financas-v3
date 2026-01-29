import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { TransactionKind } from '@/types/finance';

interface UseCategorySuggestionProps {
  description: string;
  kind: TransactionKind;
  memberId?: string;
}

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  subcategoryId: string | null;
  subcategoryName: string | null;
  confidence: 'high' | 'medium';
}

export function useCategorySuggestion({
  description,
  kind,
  memberId,
}: UseCategorySuggestionProps) {
  const { householdId } = useAuth();

  // Fetch recent transactions with category info
  const { data: transactions = [] } = useQuery({
    queryKey: ['transactions-for-suggestions', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      
      const { data, error } = await supabase
        .from('transactions')
        .select(`
          description,
          member_id,
          kind,
          category_id,
          subcategory_id,
          category:categories(id, name),
          subcategory:subcategories(id, name)
        `)
        .eq('household_id', householdId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .not('description', 'is', null)
        .neq('description', '')
        .not('category_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1000);
      
      if (error) throw error;
      return data;
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 5, // Cache for 5 minutes
  });

  const suggestion = useMemo<CategorySuggestion | null>(() => {
    const trimmedDesc = description.trim().toLowerCase();
    
    // Only suggest when description has at least 3 characters
    if (!trimmedDesc || trimmedDesc.length < 3) return null;
    
    // Filter transactions that match the kind and have a valid category
    const relevantTransactions = transactions.filter(t => 
      t.kind === kind && 
      t.category_id && 
      t.category
    );
    
    if (relevantTransactions.length === 0) return null;

    // Scoring logic for matches
    interface Match {
      categoryId: string;
      categoryName: string;
      subcategoryId: string | null;
      subcategoryName: string | null;
      score: number;
      isExact: boolean;
    }
    
    const matches: Match[] = [];
    
    relevantTransactions.forEach(t => {
      const tDesc = t.description?.trim().toLowerCase() || '';
      if (!tDesc) return;
      
      let score = 0;
      let isExact = false;
      
      // Exact match: highest priority
      if (tDesc === trimmedDesc) {
        score += 100;
        isExact = true;
      }
      // Strong match: description contains the search term or vice versa
      else if (tDesc.includes(trimmedDesc) || trimmedDesc.includes(tDesc)) {
        // Calculate similarity based on length
        const similarity = Math.min(trimmedDesc.length, tDesc.length) / Math.max(trimmedDesc.length, tDesc.length);
        score += Math.round(similarity * 50);
      } else {
        // No relevant match
        return;
      }
      
      // Bonus for same member
      if (memberId && t.member_id === memberId) {
        score += 10;
      }
      
      matches.push({
        categoryId: t.category_id!,
        categoryName: (t.category as any)?.name || '',
        subcategoryId: t.subcategory_id || null,
        subcategoryName: (t.subcategory as any)?.name || null,
        score,
        isExact,
      });
    });
    
    if (matches.length === 0) return null;
    
    // Group by category+subcategory and count occurrences with total score
    const grouped = new Map<string, { 
      match: Match; 
      count: number; 
      totalScore: number;
      hasExact: boolean;
    }>();
    
    matches.forEach(m => {
      const key = `${m.categoryId}-${m.subcategoryId || 'null'}`;
      const existing = grouped.get(key);
      
      if (existing) {
        existing.count++;
        existing.totalScore += m.score;
        existing.hasExact = existing.hasExact || m.isExact;
      } else {
        grouped.set(key, { 
          match: m, 
          count: 1, 
          totalScore: m.score,
          hasExact: m.isExact,
        });
      }
    });
    
    // Sort by: hasExact first, then by count * totalScore
    const sortedGroups = Array.from(grouped.values())
      .sort((a, b) => {
        if (a.hasExact !== b.hasExact) return b.hasExact ? 1 : -1;
        return (b.count * b.totalScore) - (a.count * a.totalScore);
      });
    
    const best = sortedGroups[0];
    if (!best) return null;
    
    // Determine confidence
    const confidence: 'high' | 'medium' = best.hasExact || best.count >= 3 ? 'high' : 'medium';
    
    return {
      categoryId: best.match.categoryId,
      categoryName: best.match.categoryName,
      subcategoryId: best.match.subcategoryId,
      subcategoryName: best.match.subcategoryName,
      confidence,
    };
  }, [transactions, description, kind, memberId]);

  return { suggestion };
}
