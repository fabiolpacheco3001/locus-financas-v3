import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { RiskEvent, RiskEventType, RiskEventMetadata } from '@/types/riskEvents';
import { format } from 'date-fns';
import { Json } from '@/integrations/supabase/types';
import { sanitizeRiskEventMetadata } from '@/lib/sanitizeMetadata';

export function useRiskEvents(referenceMonth?: Date) {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();

  const monthStr = referenceMonth ? format(referenceMonth, 'yyyy-MM') : undefined;

  // Fetch risk events for a specific month or all
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['risk-events', householdId, monthStr],
    queryFn: async () => {
      if (!householdId) return [];

      let query = supabase
        .from('risk_events')
        .select('*')
        .eq('household_id', householdId)
        .order('created_at', { ascending: false });

      if (monthStr) {
        query = query.eq('reference_month', monthStr);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data as RiskEvent[];
    },
    enabled: !!householdId,
  });

  // Register a new risk event
  const registerEvent = useMutation({
    mutationFn: async ({
      eventType,
      referenceMonth,
      referenceId,
      referenceType,
      metadata,
    }: {
      eventType: RiskEventType;
      referenceMonth: string;
      referenceId?: string;
      referenceType?: 'transaction' | 'account' | 'simulation';
      metadata?: RiskEventMetadata;
    }) => {
      if (!householdId) throw new Error('No household');

      // Sanitize metadata before insertion (allowlist + size limit)
      const sanitizedMetadata = sanitizeRiskEventMetadata(metadata);

      const { data, error } = await supabase
        .from('risk_events')
        .insert([{
          household_id: householdId,
          event_type: eventType,
          reference_month: referenceMonth,
          reference_id: referenceId || null,
          reference_type: referenceType || null,
          metadata: sanitizedMetadata as Json,
        }])
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['risk-events', householdId] });
    },
    onError: (error) => {
      // Silent fail for risk events - non-critical, log for debugging
      console.error('[RiskEvents] Failed to register event:', error);
    },
  });

  // Check if event already exists (to avoid duplicates)
  const hasRecentEvent = (
    eventType: RiskEventType,
    month: string,
    referenceId?: string,
    withinMinutes = 60
  ): boolean => {
    const cutoff = new Date(Date.now() - withinMinutes * 60 * 1000);
    
    return events.some(
      (e) =>
        e.event_type === eventType &&
        e.reference_month === month &&
        (referenceId ? e.reference_id === referenceId : true) &&
        new Date(e.created_at) > cutoff
    );
  };

  return {
    events,
    isLoading,
    registerEvent,
    hasRecentEvent,
  };
}
