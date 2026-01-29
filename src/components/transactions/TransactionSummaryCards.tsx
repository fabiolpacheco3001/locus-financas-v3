import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { TrendingUp, TrendingDown, Wallet, AlertCircle, CheckCircle2, Calendar, HelpCircle } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface SummaryData {
  incomeRealized: number;
  expenseRealized: number;
  saldoDisponivel: number;
  aPagarMes: number;
  saldoPrevistoMes: number;
  plannedExpenseCount: number;
  showTotalFiltered?: boolean;
}

interface TransactionSummaryCardsProps {
  data: SummaryData;
  isAnimatingAPagar?: boolean;
  hasSegmentingFilter?: boolean;
}

export function TransactionSummaryCards({
  data,
  isAnimatingAPagar = false,
  hasSegmentingFilter = false,
}: TransactionSummaryCardsProps) {
  const { t, formatCurrency } = useLocale();

  return (
    <div className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      {/* Receitas */}
      <Card className="border-border/50 bg-card shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-success/10">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('dashboard.income')}
              </p>
              <p className="mt-0.5 text-lg font-bold text-success">
                {formatCurrency(data.incomeRealized)}
              </p>
              <p className="text-[10px] text-muted-foreground">{t('dashboard.confirmedInMonth')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Despesas */}
      <Card className="border-border/50 bg-card shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <TrendingDown className="h-5 w-5 text-destructive" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {t('dashboard.expenses')}
              </p>
              <p className="mt-0.5 text-lg font-bold text-destructive">
                {formatCurrency(data.expenseRealized)}
              </p>
              <p className="text-[10px] text-muted-foreground">{t('dashboard.confirmedInMonth')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saldo disponível */}
      <Card className="border-border/50 bg-card shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              data.saldoDisponivel >= 0 ? "bg-success/10" : "bg-destructive/10"
            )}>
              <Wallet className={cn(
                "h-5 w-5",
                data.saldoDisponivel >= 0 ? "text-success" : "text-destructive"
              )} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {hasSegmentingFilter ? t('transactions.summary.impact') : t('dashboard.balance')}
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[200px]">
                      <p className="text-sm">{t('dashboard.balanceTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className={cn(
                "mt-0.5 text-lg font-bold",
                data.saldoDisponivel >= 0 ? "text-success" : "text-destructive"
              )}>
                {data.showTotalFiltered
                  ? formatCurrency(data.expenseRealized)
                  : formatCurrency(data.saldoDisponivel)
                }
              </p>
              <p className="text-[10px] text-muted-foreground">{t('dashboard.balanceSubtitle')}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* A pagar */}
      <Card className={cn(
        "transition-all duration-300 shadow-sm",
        isAnimatingAPagar && "scale-[1.02] ring-2 ring-success ring-offset-2 ring-offset-background",
        data.aPagarMes > 0
          ? "border-warning bg-warning/5"
          : "border-success/50 bg-success/5"
      )}>
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-all duration-300",
              isAnimatingAPagar && "animate-pulse",
              data.aPagarMes > 0 ? "bg-warning/20" : "bg-success/20"
            )}>
              {data.aPagarMes > 0 ? (
                <AlertCircle className="h-5 w-5 text-warning" />
              ) : (
                <CheckCircle2 className={cn(
                  "h-5 w-5 text-success",
                  isAnimatingAPagar && "animate-bounce"
                )} />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.toPay')}
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px]">
                      <p className="text-sm">{t('dashboard.toPayTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              {data.aPagarMes > 0 ? (
                <>
                  <p className={cn(
                    "mt-0.5 text-lg font-bold text-warning",
                    isAnimatingAPagar && "animate-pulse"
                  )}>
                    {formatCurrency(data.aPagarMes)}
                  </p>
                  <p className="text-[10px] font-medium text-warning/80">
                    {t('status.pendingCount', { count: data.plannedExpenseCount })}
                  </p>
                </>
              ) : (
                <>
                  <p className={cn(
                    "mt-0.5 text-lg font-bold text-success",
                    isAnimatingAPagar && "animate-pulse"
                  )}>
                    {formatCurrency(0)}
                  </p>
                  <p className="text-[10px] font-medium text-success/80">
                    {t('status.noPending')}
                  </p>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Saldo previsto */}
      <Card className="border-dashed border-primary/30 bg-primary/5 shadow-sm transition-shadow hover:shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
              data.saldoPrevistoMes >= 0 ? "bg-primary/20" : "bg-destructive/20"
            )}>
              <Calendar className={cn(
                "h-5 w-5",
                data.saldoPrevistoMes >= 0 ? "text-primary" : "text-destructive"
              )} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {t('dashboard.forecast')}
                </p>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3 w-3 shrink-0 cursor-help text-muted-foreground/60" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-[220px]">
                      <p className="text-sm">{t('dashboard.forecastTooltip')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className={cn(
                "mt-0.5 text-lg font-bold",
                data.saldoPrevistoMes >= 0 ? "text-primary" : "text-destructive"
              )}>
                {formatCurrency(data.saldoPrevistoMes)}
              </p>
              <p className="text-[10px] text-muted-foreground">{t('dashboard.forecastSubtitle')}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
