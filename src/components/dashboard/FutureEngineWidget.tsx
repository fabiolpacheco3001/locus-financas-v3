/**
 * FutureEngineWidget - Financial Forecast Widget
 * 
 * Displays end-of-month balance projection with:
 * - Gradient progress bar (Safe Spending Zone)
 * - Risk level indicators
 * - Breakdown details
 * - Legal disclaimer
 */

import { motion } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Progress } from '@/components/ui/progress';
import { 
  Rocket, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  CheckCircle2,
  Info,
  Zap,
  Shield
} from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';
import type { UseFutureEngineResult } from '@/hooks/useFutureEngine';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

// ============================================
// TYPES
// ============================================

interface FutureEngineWidgetProps {
  data: UseFutureEngineResult;
  className?: string;
}

// ============================================
// HELPER COMPONENTS
// ============================================

function RiskBadge({ riskLevel }: { riskLevel?: 'safe' | 'caution' | 'danger' }) {
  const { t } = useLocale();
  
  const config = {
    safe: {
      variant: 'outline' as const,
      className: 'border-success/50 text-success bg-success/10',
      icon: CheckCircle2,
      label: t('futureEngine.risk.safe'),
    },
    caution: {
      variant: 'outline' as const,
      className: 'border-warning/50 text-warning bg-warning/10',
      icon: AlertTriangle,
      label: t('futureEngine.risk.caution'),
    },
    danger: {
      variant: 'destructive' as const,
      className: '',
      icon: AlertTriangle,
      label: t('futureEngine.risk.danger'),
    },
  };

  const { variant, className, icon: Icon, label } = config[riskLevel || 'safe'] || config.safe;

  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon className="h-3 w-3" />
      {label}
    </Badge>
  );
}

function GradientProgressBar({ 
  percentage, 
  riskLevel 
}: { 
  percentage: number; 
  riskLevel: 'safe' | 'caution' | 'danger';
}) {
  // Gradient from success (left) to destructive (right)
  // The filled area represents "safe" zone
  return (
    <div 
      className="relative h-4 rounded-full overflow-hidden bg-gradient-to-r from-success via-warning to-destructive"
      data-testid="future-engine-safe-zone-bar"
    >
      {/* Overlay that covers the "used" portion */}
      <div 
        className="absolute right-0 top-0 h-full bg-muted/80 transition-all duration-500 ease-out"
        style={{ width: `${100 - percentage}%` }}
      />
      
      {/* Marker line at current position */}
      <motion.div 
        className="absolute top-0 h-full w-1 bg-foreground/80 shadow-lg"
        style={{ left: `${percentage}%` }}
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.3 }}
      />

      {/* Glow effect at marker */}
      <motion.div 
        className={cn(
          "absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full blur-sm",
          riskLevel === 'safe' && "bg-success",
          riskLevel === 'caution' && "bg-warning",
          riskLevel === 'danger' && "bg-destructive"
        )}
        style={{ left: `${percentage}%`, marginLeft: '-6px' }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 0.8 }}
        transition={{ delay: 0.5, duration: 0.3 }}
      />
    </div>
  );
}

function ConfidenceBadge({ level }: { level?: 'high' | 'medium' | 'low' }) {
  const { t } = useLocale();
  
  const config = {
    high: { icon: Shield, color: 'text-success' },
    medium: { icon: Zap, color: 'text-warning' },
    low: { icon: Info, color: 'text-muted-foreground' },
  };

  const { icon: Icon, color } = config[level || 'low'] || config.low;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn('flex items-center gap-1 text-xs', color)}>
            <Icon className="h-3 w-3" />
            <span className="hidden sm:inline">{t(`futureEngine.confidence.${level}`)}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p className="text-xs">{t(`futureEngine.confidence.${level}Tooltip`)}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function FutureEngineWidget({ data, className }: FutureEngineWidgetProps) {
  const { t, formatCurrency } = useLocale();

  const {
    estimatedEndOfMonth,
    safeSpendingZone,
    riskLevel,
    riskPercentage,
    projectedVariableRemaining,
    totalProjectedExpenses,
    daysRemaining,
    isLoading,
    isDataSufficient,
    confidenceLevel,
    historicalVariableAvg,
  } = data;

  if (isLoading) {
    return (
      <Card className={cn("bg-card/80 backdrop-blur-md border-border/50", className)}>
        <CardHeader className="pb-2">
          <Skeleton className="h-6 w-48" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-32" />
          <Skeleton className="h-4 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <Card 
        className={cn("bg-card/80 backdrop-blur-md border-border/50", className)}
        data-testid="future-engine-widget"
      >
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Rocket className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">{t('futureEngine.title')}</CardTitle>
            </div>
            {/* Right badges - hidden on mobile for cleaner layout */}
            <div className="hidden items-center gap-2 sm:flex">
              <ConfidenceBadge level={confidenceLevel || 'low'} />
              <Badge variant="outline" className="gap-1 text-xs border-primary/30 text-primary bg-primary/5">
                <Zap className="h-3 w-3" />
                {t('futureEngine.syncBadge')}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Estimated Balance */}
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-muted-foreground">{t('futureEngine.estimatedBalance')}</p>
              <p 
                className={cn(
                  "text-2xl sm:text-3xl font-bold",
                  estimatedEndOfMonth >= 0 ? "text-foreground" : "text-destructive"
                )}
                data-testid="future-engine-estimated-balance"
              >
                {formatCurrency(estimatedEndOfMonth)}
              </p>
              {daysRemaining > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t('futureEngine.daysRemaining', { count: daysRemaining })}
                </p>
              )}
            </div>
            <RiskBadge riskLevel={riskLevel || 'safe'} />
          </div>

          {/* Safe Spending Zone Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">{t('futureEngine.safeZone')}</span>
              <span 
                className={cn(
                  "font-semibold",
                  (riskLevel || 'safe') === 'safe' && "text-success",
                  (riskLevel || 'safe') === 'caution' && "text-warning",
                  (riskLevel || 'safe') === 'danger' && "text-destructive"
                )}
                data-testid="future-engine-risk-indicator"
              >
                {formatCurrency(safeSpendingZone)} {t('futureEngine.availableToSpend')}
              </span>
            </div>
            <GradientProgressBar percentage={riskPercentage} riskLevel={riskLevel || 'safe'} />
          </div>

          {/* Breakdown */}
          {isDataSufficient && (
            <div className="grid grid-cols-2 gap-3 pt-2">
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <TrendingDown className="h-3 w-3" />
                  {t('futureEngine.breakdown.fixedExpenses')}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(totalProjectedExpenses - projectedVariableRemaining)}
                </p>
              </div>
              <div className="rounded-lg border border-border/50 bg-muted/30 p-3">
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                  <TrendingUp className="h-3 w-3" />
                  {t('futureEngine.breakdown.variableAverage')}
                </div>
                <p className="text-sm font-semibold text-foreground">
                  {formatCurrency(historicalVariableAvg)}
                  <span className="text-xs text-muted-foreground font-normal">/mês</span>
                </p>
              </div>
            </div>
          )}

          {/* Insufficient Data Warning - hidden on mobile */}
          {!isDataSufficient && (
            <div className="hidden items-center gap-2 rounded-lg border border-warning/30 bg-warning/5 p-3 sm:flex">
              <Info className="h-4 w-4 text-warning flex-shrink-0" />
              <p className="text-xs text-warning">
                {t('futureEngine.insufficientData')}
              </p>
            </div>
          )}

          {/* Legal Disclaimer - hidden on mobile */}
          <div className="hidden border-t border-border/50 pt-2 sm:block">
            <p className="text-xs text-muted-foreground text-center italic">
              ⚠️ {t('futureEngine.disclaimer')}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
