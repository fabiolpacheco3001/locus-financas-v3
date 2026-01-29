import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CalendarDays, CheckCircle2, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFinancialRadar, type RadarCategory } from '@/hooks/useFinancialRadar';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface RadarCardProps {
  title: string;
  category: RadarCategory;
  icon: React.ReactNode;
  colorScheme: 'success' | 'danger' | 'warning' | 'info';
  emptyMessage?: string;
  onClick?: () => void;
  tooltipContent?: string;
  formatCurrency: (value: number) => string;
  isClickable?: boolean;
}

const colorSchemes = {
  success: {
    bg: 'bg-emerald-50 dark:bg-emerald-950/30',
    border: 'border-emerald-200 dark:border-emerald-800/50',
    icon: 'text-emerald-600 dark:text-emerald-400',
    text: 'text-emerald-700 dark:text-emerald-300',
    amount: 'text-emerald-800 dark:text-emerald-200',
  },
  danger: {
    bg: 'bg-red-50 dark:bg-red-950/30',
    border: 'border-red-200 dark:border-red-800/50',
    icon: 'text-red-600 dark:text-red-400',
    text: 'text-red-700 dark:text-red-300',
    amount: 'text-red-800 dark:text-red-200',
  },
  warning: {
    bg: 'bg-amber-50 dark:bg-amber-950/30',
    border: 'border-amber-200 dark:border-amber-800/50',
    icon: 'text-amber-600 dark:text-amber-400',
    text: 'text-amber-700 dark:text-amber-300',
    amount: 'text-amber-800 dark:text-amber-200',
  },
  info: {
    bg: 'bg-blue-50 dark:bg-blue-950/30',
    border: 'border-blue-200 dark:border-blue-800/50',
    icon: 'text-blue-600 dark:text-blue-400',
    text: 'text-blue-700 dark:text-blue-300',
    amount: 'text-blue-800 dark:text-blue-200',
  },
};

function RadarCard({
  title,
  category,
  icon,
  colorScheme,
  emptyMessage,
  onClick,
  tooltipContent,
  formatCurrency,
  isClickable = true,
}: RadarCardProps) {
  const colors = colorSchemes[colorScheme];
  // Safe access with Optional Chaining and nullish coalescing
  const isEmpty = (category?.count ?? 0) === 0;

  const content = (
    <Card
      className={cn(
        'transition-all duration-200 border',
        colors.bg,
        colors.border,
        isClickable && !isEmpty && 'cursor-pointer hover:shadow-md hover:scale-[1.02]',
        isEmpty && 'opacity-90'
      )}
      onClick={!isEmpty && isClickable ? onClick : undefined}
      data-testid={`radar-card-${colorScheme}`}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className={cn('text-xs font-medium uppercase tracking-wide mb-1', colors.text)}>
              {title}
            </p>
            {isEmpty && emptyMessage ? (
              <p className={cn('text-sm font-medium', colors.text)}>{emptyMessage}</p>
            ) : (
              <>
                <p className={cn('text-xl font-bold tabular-nums', colors.amount)}>
                  {formatCurrency(category?.amount ?? 0)}
                </p>
                <p className={cn('text-xs mt-0.5', colors.text)}>
                  {category?.count ?? 0} {(category?.count ?? 0) === 1 ? 'conta' : 'contas'}
                </p>
              </>
            )}
          </div>
          <div className={cn('p-2 rounded-lg', colors.bg, colors.icon)}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );

  if (tooltipContent && !isEmpty) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <p className="text-sm">{tooltipContent}</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
}

export function MaturityRadar() {
  const navigate = useNavigate();
  const { t, formatCurrency } = useLocale();
  const { radar, isLoading, isError, error } = useFinancialRadar();

  if (isLoading) {
    return (
      <div className="mb-4 flex items-center justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError) {
    // Log error for debugging instead of failing silently
    console.error('[MaturityRadar] Error loading financial radar:', error);
    // Return empty state instead of null to prevent crashes
    return (
      <div className="mb-4 grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            {t('dashboard.radar.allClear')}
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            {t('dashboard.radar.nothingToday')}
          </CardContent>
        </Card>
        <Card className="bg-muted/30">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            {t('dashboard.radar.upcoming7Days')}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Safe access with Optional Chaining - ensure radar and its properties exist
  const radarData = radar ?? {
    overdue: { count: 0, amount: 0 },
    today: { count: 0, amount: 0 },
    upcoming: { count: 0, amount: 0 },
  };

  const hasOverdue = (radarData.overdue?.count ?? 0) > 0;
  const hasToday = (radarData.today?.count ?? 0) > 0;

  return (
    <TooltipProvider>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="mb-4"
        data-testid="maturity-radar"
      >
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
          {/* Card 1: Vencidos (Overdue) */}
          <RadarCard
            title={t('dashboard.radar.overdue')}
            category={radarData.overdue ?? { count: 0, amount: 0 }}
            icon={hasOverdue ? <AlertTriangle className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
            colorScheme={hasOverdue ? 'danger' : 'success'}
            emptyMessage={t('dashboard.radar.allClear')}
            onClick={() => navigate('/transactions?status=planned&period=overdue')}
            formatCurrency={formatCurrency}
          />

          {/* Card 2: Vence Hoje (Due Today) */}
          <RadarCard
            title={t('dashboard.radar.dueToday')}
            category={radarData.today ?? { count: 0, amount: 0 }}
            icon={<Clock className="h-5 w-5" />}
            colorScheme={hasToday ? 'warning' : 'info'}
            emptyMessage={t('dashboard.radar.nothingToday')}
            onClick={() => navigate('/transactions?status=planned&period=today')}
            formatCurrency={formatCurrency}
            isClickable={hasToday}
          />

          {/* Card 3: Próximos 7 dias (Upcoming) */}
          <RadarCard
            title={t('dashboard.radar.upcoming7Days')}
            category={radarData.upcoming ?? { count: 0, amount: 0 }}
            icon={<CalendarDays className="h-5 w-5" />}
            colorScheme="info"
            tooltipContent={
              (radarData.upcoming?.count ?? 0) > 0
                ? t('dashboard.radar.upcomingTooltip', { count: radarData.upcoming?.count ?? 0 })
                : undefined
            }
            onClick={() => navigate('/transactions?status=planned&period=week')}
            formatCurrency={formatCurrency}
            isClickable={(radarData.upcoming?.count ?? 0) > 0}
          />
        </div>
      </motion.div>
    </TooltipProvider>
  );
}
