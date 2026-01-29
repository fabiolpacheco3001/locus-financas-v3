import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getLocalTodayISO } from '@/lib/dateUtils';

export interface RadarCategory {
  count: number;
  amount: number;
}

export interface FinancialRadarData {
  overdue: RadarCategory;
  today: RadarCategory;
  upcoming: RadarCategory;
  reference_date: string;
}

const emptyRadar: FinancialRadarData = {
  overdue: { count: 0, amount: 0 },
  today: { count: 0, amount: 0 },
  upcoming: { count: 0, amount: 0 },
  reference_date: getLocalTodayISO(),
};

export function useFinancialRadar() {
  const { householdId } = useAuth();
  const userToday = getLocalTodayISO();

  const query = useQuery({
    queryKey: ['financial-radar', householdId, userToday],
    queryFn: async (): Promise<FinancialRadarData> => {
      try {
        if (!householdId) return emptyRadar;

        const { data, error } = await supabase.rpc('get_financial_radar', {
          p_household_id: householdId,
          p_user_today: userToday,
        });

        if (error) {
          console.error('[useFinancialRadar] RPC error:', error);
          // Return empty radar instead of throwing to prevent crashes
          return emptyRadar;
        }

        // Ensure data has the expected structure with safe defaults
        const radarData = (data as unknown as FinancialRadarData) ?? emptyRadar;
        
        return {
          overdue: {
            count: radarData?.overdue?.count ?? 0,
            amount: radarData?.overdue?.amount ?? 0,
          },
          today: {
            count: radarData?.today?.count ?? 0,
            amount: radarData?.today?.amount ?? 0,
          },
          upcoming: {
            count: radarData?.upcoming?.count ?? 0,
            amount: radarData?.upcoming?.amount ?? 0,
          },
          reference_date: radarData?.reference_date ?? getLocalTodayISO(),
        };
      } catch (error) {
        console.error('[useFinancialRadar] Unexpected error:', error);
        // Return empty radar to prevent undefined returns
        return emptyRadar;
      }
    },
    enabled: !!householdId,
    staleTime: 1000 * 60, // 1 minute
    refetchOnWindowFocus: true,
  });

  return {
    radar: query.data ?? emptyRadar,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
