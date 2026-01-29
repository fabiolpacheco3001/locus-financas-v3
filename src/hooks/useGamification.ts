import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useLocale } from '@/i18n/useLocale';
import {
  UserStats,
  XP_REWARDS,
  getLevelFromXp,
  getNextLevel,
  getXpForNextLevel,
  LEVEL_DEFINITIONS,
} from '@/types/gamification';

export function useGamification() {
  const { householdId } = useAuth();
  const queryClient = useQueryClient();
  const { t } = useLocale();

  // Fetch user stats
  const { data: stats, isLoading } = useQuery({
    queryKey: ['user-stats', householdId],
    queryFn: async () => {
      if (!householdId) return null;

      const { data, error } = await supabase
        .from('user_stats')
        .select('*')
        .eq('household_id', householdId)
        .maybeSingle();

      if (error) throw error;

      // If no stats exist, create initial record
      if (!data) {
        const { data: newStats, error: insertError } = await supabase
          .from('user_stats')
          .insert({ household_id: householdId })
          .select()
          .single();

        if (insertError) throw insertError;
        return newStats as UserStats;
      }

      return data as UserStats;
    },
    enabled: !!householdId,
  });

  // Calculate derived values
  const currentLevel = stats ? getLevelFromXp(stats.total_xp) : LEVEL_DEFINITIONS[0];
  const nextLevel = getNextLevel(currentLevel.level);
  const xpProgress = stats ? getXpForNextLevel(stats.total_xp) : { current: 0, needed: 1000, progress: 0 };

  // Add XP mutation
  const addXp = useMutation({
    mutationFn: async ({ amount, reason }: { amount: number; reason: string }) => {
      if (!householdId || !stats) throw new Error('No stats available');

      const today = format(new Date(), 'yyyy-MM-dd');
      const isFirstOfDay = stats.last_activity_date !== today;
      
      // Calculate total XP to add (including bonuses)
      let totalXpToAdd = amount;
      if (isFirstOfDay) {
        totalXpToAdd += XP_REWARDS.FIRST_OF_DAY;
      }

      // Calculate new streak
      let newStreakDays = stats.streak_days;
      if (isFirstOfDay) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
        
        if (stats.last_activity_date === yesterdayStr) {
          // Consecutive day - increase streak
          newStreakDays += 1;
          totalXpToAdd += XP_REWARDS.STREAK_BONUS;
        } else if (stats.last_activity_date !== today) {
          // Streak broken - reset
          newStreakDays = 1;
        }
      }

      const newTotalXp = stats.total_xp + totalXpToAdd;
      const previousLevel = getLevelFromXp(stats.total_xp);
      const newLevel = getLevelFromXp(newTotalXp);

      // Update stats
      const { error } = await supabase
        .from('user_stats')
        .update({
          total_xp: newTotalXp,
          current_xp: getXpForNextLevel(newTotalXp).current,
          current_level: newLevel.level,
          streak_days: newStreakDays,
          last_activity_date: today,
        })
        .eq('household_id', householdId);

      if (error) throw error;

      return {
        xpAdded: totalXpToAdd,
        newTotalXp,
        leveledUp: newLevel.level > previousLevel.level,
        newLevel,
        streakBonus: isFirstOfDay && stats.last_activity_date ? XP_REWARDS.STREAK_BONUS : 0,
        isFirstOfDay,
      };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['user-stats'] });

      // Show level up celebration
      if (result.leveledUp) {
        toast.success(
          t('gamification.levelUp', {
            level: result.newLevel.level,
            name: t(result.newLevel.nameKey),
          }),
          {
            icon: result.newLevel.icon,
            duration: 5000,
            className: 'gamification-toast',
          }
        );
      }
    },
  });

  // Helper to award XP for transaction creation
  const awardTransactionXp = () => {
    if (stats) {
      addXp.mutate({ amount: XP_REWARDS.TRANSACTION_CREATE, reason: 'transaction_create' });
    }
  };

  // Helper to award XP for transaction confirmation
  const awardConfirmationXp = () => {
    if (stats) {
      addXp.mutate({ amount: XP_REWARDS.TRANSACTION_CONFIRM, reason: 'transaction_confirm' });
    }
  };

  // Helper to award XP for budget creation
  const awardBudgetXp = () => {
    if (stats) {
      addXp.mutate({ amount: XP_REWARDS.BUDGET_CREATE, reason: 'budget_create' });
    }
  };

  return {
    stats,
    isLoading,
    currentLevel,
    nextLevel,
    xpProgress,
    addXp: addXp.mutate,
    awardTransactionXp,
    awardConfirmationXp,
    awardBudgetXp,
    isMaxLevel: !nextLevel,
  };
}
