import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FlaskConical, RotateCcw, TrendingUp, TrendingDown, ArrowRight } from 'lucide-react';
import { SimulationComparison } from '@/hooks/useSimulation';
import { useLocale } from '@/i18n/useLocale';

interface SimulationBannerProps {
  description: string;
  comparison: SimulationComparison | null;
  onClear: () => void;
}

export function SimulationBanner({ description, comparison, onClear }: SimulationBannerProps) {
  const { t, formatCurrency } = useLocale();

  return (
    <div className="sticky top-0 z-10 bg-primary/10 border-b border-primary/30 px-4 py-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        {/* Left side - Mode indicator */}
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 shrink-0">
            <FlaskConical className="h-4 w-4 text-primary" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <Badge variant="default" className="bg-primary text-xs">
                {t('simulation.mode')}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5">
              {t('simulation.description')} <span className="font-medium">{t('simulation.nothingSaved')}</span>
            </p>
          </div>
        </div>

        {/* Center - Comparison showing A pagar impact */}
        {comparison && (
          <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-4 bg-background/80 rounded-lg px-3 py-2">
            {/* A pagar (mês) comparison */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('simulation.pendingBillsThisMonth')}</p>
                <p className="text-sm font-semibold text-muted-foreground">
                  {formatCurrency(comparison.beforePendingExpenses)}
                </p>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="text-center">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t('simulation.pendingBillsAfter')}</p>
                <p className={`text-sm font-semibold ${comparison.afterPendingExpenses < comparison.beforePendingExpenses ? 'text-emerald-600' : 'text-destructive'}`}>
                  {formatCurrency(comparison.afterPendingExpenses)}
                </p>
              </div>
            </div>
            
            {/* Impact message */}
            {comparison.expensesDifference !== 0 && (
              <div className="border-l border-border pl-2 sm:pl-4">
                <p className={`text-sm font-medium flex items-center gap-1.5 ${comparison.expensesDifference < 0 ? 'text-emerald-600' : 'text-destructive'}`}>
                  {comparison.expensesDifference < 0 ? (
                    <TrendingDown className="h-4 w-4" />
                  ) : (
                    <TrendingUp className="h-4 w-4" />
                  )}
                  {t('simulation.impact')}: {comparison.expensesDifference < 0 ? '-' : '+'}{formatCurrency(Math.abs(comparison.expensesDifference))} {t('simulation.impactOnToPay')}
                </p>
                {comparison.expensesDifference < 0 && (
                  <p className="text-xs text-emerald-600/80 mt-0.5">
                    {t('simulation.gainedBreathingRoom')}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Right side - Clear button */}
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onClear}
          className="shrink-0"
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          {t('simulation.clearSimulation')}
        </Button>
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mt-2 pl-11">
        {description}
      </p>
    </div>
  );
}
