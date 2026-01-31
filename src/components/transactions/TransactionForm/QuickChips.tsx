import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";

interface QuickChipsProps {
  onSelect: (description: string) => void;
  onSelectComplete?: (description: string) => void;
  currentValue: string;
}

export function QuickChips({ onSelect, onSelectComplete, currentValue }: QuickChipsProps) {
  const { householdId } = useAuth();

  // Fetch most frequent descriptions
  const { data: frequentDescriptions = [] } = useQuery({
    queryKey: ['frequent-descriptions', householdId],
    queryFn: async () => {
      if (!householdId) return [];
      
      const { data, error } = await supabase
        .from('transactions')
        .select('description')
        .eq('household_id', householdId)
        .in('status', ['planned', 'confirmed'])
        .is('cancelled_at', null)
        .not('description', 'is', null)
        .neq('description', '')
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      
      // Count frequencies
      const freqMap = new Map<string, number>();
      data.forEach(t => {
        const desc = t.description?.trim();
        if (desc) {
          freqMap.set(desc, (freqMap.get(desc) || 0) + 1);
        }
      });
      
      // Get top 4 by frequency
      return Array.from(freqMap.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([desc]) => desc);
    },
    enabled: !!householdId,
    staleTime: 1000 * 60 * 5,
  });

  const chips = useMemo(() => {
    // Filter out current value if already typed
    const searchTerm = (currentValue || "").trim().toLowerCase();
    return frequentDescriptions.filter(d => 
      (d || "").toLowerCase() !== searchTerm
    ).slice(0, 4);
  }, [frequentDescriptions, currentValue]);

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2" data-testid="quick-chips">
      {chips.map((desc) => (
        <Badge
          key={desc}
          variant="secondary"
          className="cursor-pointer hover:bg-primary/20 hover:text-primary transition-colors px-3 py-1.5 text-sm"
          onClick={() => {
            onSelect(desc);
            onSelectComplete?.(desc);
          }}
          data-testid={`chip-${desc.replace(/\s+/g, '-').toLowerCase()}`}
        >
          {desc}
        </Badge>
      ))}
    </div>
  );
}
