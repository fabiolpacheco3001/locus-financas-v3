import { useGamification } from '@/hooks/useGamification';
import { useLocale } from '@/i18n/useLocale';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { Zap, Trophy, Flame } from 'lucide-react';

interface XpProgressBarProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function XpProgressBar({ variant = 'compact', className }: XpProgressBarProps) {
  const { stats, currentLevel, nextLevel, xpProgress, isMaxLevel, isLoading } = useGamification();
  const { t } = useLocale();

  if (isLoading || !stats) {
    return null;
  }

  const levelName = t(currentLevel.nameKey);

  if (variant === 'compact') {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full",
            "bg-gradient-to-r from-yellow-500/10 to-amber-500/10",
            "border border-yellow-500/20 hover:border-yellow-500/40",
            "cursor-pointer transition-all duration-300",
            "group",
            className
          )}>
            <span className="text-sm">{currentLevel.icon}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-yellow-400">
                Lv.{currentLevel.level}
              </span>
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${xpProgress.progress}%` }}
                />
              </div>
            </div>
            {stats.streak_days > 1 && (
              <div className="flex items-center gap-0.5 text-orange-400">
                <Flame className="h-3 w-3" />
                <span className="text-xs font-bold">{stats.streak_days}</span>
              </div>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="p-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-lg">{currentLevel.icon}</span>
              <div>
                <p className="font-semibold text-yellow-400">{levelName}</p>
                <p className="text-xs text-muted-foreground">
                  {t('gamification.totalXp', { xp: stats.total_xp })}
                </p>
              </div>
            </div>
            {!isMaxLevel && nextLevel && (
              <div className="pt-2 border-t border-border">
                <p className="text-xs text-muted-foreground mb-1">
                  {t('gamification.nextLevel', { name: t(nextLevel.nameKey) })}
                </p>
                <div className="flex items-center gap-2">
                  <Progress value={xpProgress.progress} className="h-2 flex-1" />
                  <span className="text-xs font-mono text-yellow-400">
                    {xpProgress.current}/{xpProgress.needed}
                  </span>
                </div>
              </div>
            )}
            {stats.streak_days > 0 && (
              <div className="flex items-center gap-1 text-orange-400 pt-1">
                <Flame className="h-4 w-4" />
                <span className="text-xs">
                  {t('gamification.streak', { days: stats.streak_days })}
                </span>
              </div>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    );
  }

  // Full variant for sidebar
  return (
    <div className={cn(
      "p-4 rounded-xl",
      "bg-gradient-to-br from-yellow-500/10 via-amber-500/5 to-orange-500/10",
      "border border-yellow-500/20",
      "space-y-3",
      className
    )}>
      {/* Level Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-xl shadow-lg shadow-yellow-500/20">
            {currentLevel.icon}
          </div>
          <div>
            <p className="font-semibold text-foreground">{levelName}</p>
            <p className="text-xs text-muted-foreground">
              {t('gamification.level', { level: currentLevel.level })}
            </p>
          </div>
        </div>
        {stats.streak_days > 1 && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-orange-500/20 text-orange-400">
            <Flame className="h-4 w-4" />
            <span className="text-sm font-bold">{stats.streak_days}</span>
          </div>
        )}
      </div>

      {/* XP Progress */}
      {!isMaxLevel && nextLevel ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">
              {t('gamification.progressTo', { name: t(nextLevel.nameKey) })}
            </span>
            <span className="font-mono text-yellow-400">
              {xpProgress.current}/{xpProgress.needed} XP
            </span>
          </div>
          <div className="relative h-3 bg-muted rounded-full overflow-hidden">
            <div 
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 via-amber-400 to-orange-400 rounded-full transition-all duration-700 ease-out"
              style={{ width: `${xpProgress.progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-transparent to-white/20" />
            </div>
            <Zap className="absolute right-1 top-1/2 -translate-y-1/2 h-2 w-2 text-yellow-400/50" />
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-center gap-2 py-2 text-yellow-400">
          <Trophy className="h-5 w-5" />
          <span className="font-semibold">{t('gamification.maxLevel')}</span>
        </div>
      )}

      {/* Stats */}
      <div className="flex items-center justify-between pt-2 border-t border-yellow-500/10 text-xs text-muted-foreground">
        <span>{t('gamification.totalXp', { xp: stats.total_xp })}</span>
        {stats.streak_days > 0 && (
          <span className="flex items-center gap-1">
            <Flame className="h-3 w-3 text-orange-400" />
            {t('gamification.streakShort', { days: stats.streak_days })}
          </span>
        )}
      </div>
    </div>
  );
}
