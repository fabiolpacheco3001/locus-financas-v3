import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeterministicInsight, InsightSeverity } from '@/hooks/useDeterministicInsights';
import { AlertTriangle, AlertCircle, Info, Lightbulb } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';

interface InsightsCardProps {
  insights: DeterministicInsight[];
}

const severityConfig: Record<InsightSeverity, { icon: typeof AlertTriangle; className: string; bgClass: string }> = {
  critical: {
    icon: AlertTriangle,
    className: 'text-destructive',
    bgClass: 'bg-destructive/10',
  },
  warning: {
    icon: AlertCircle,
    className: 'text-amber-600 dark:text-amber-500',
    bgClass: 'bg-amber-500/10',
  },
  info: {
    icon: Info,
    className: 'text-blue-600 dark:text-blue-400',
    bgClass: 'bg-blue-500/10',
  },
};

export function InsightsCard({ insights }: InsightsCardProps) {
  const { t, formatCurrency } = useLocale();

  if (insights.length === 0) {
    return null;
  }

  /**
   * Translate insight message with formatted currency values.
   * Params with numeric amounts are formatted using locale-aware currency.
   */
  const translateInsight = (insight: DeterministicInsight): string => {
    const formattedParams: Record<string, unknown> = { ...insight.params };
    
    // Format currency fields
    const currencyFields = ['amount', 'deficit', 'total', 'missing'];
    currencyFields.forEach(field => {
      if (typeof formattedParams[field] === 'number') {
        formattedParams[field] = formatCurrency(formattedParams[field] as number);
      }
    });

    return t(insight.messageKey, formattedParams);
  };

  return (
    <Card className="border-l-4 border-l-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          {t('dashboard.insights.title')}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {insights.map((insight) => {
          const config = severityConfig[insight.severity];
          const Icon = config.icon;

          return (
            <div
              key={insight.id}
              className={cn(
                'flex items-start gap-3 rounded-lg p-3',
                config.bgClass
              )}
            >
              <Icon className={cn('h-4 w-4 mt-0.5 flex-shrink-0', config.className)} />
              <div className="flex-1 min-w-0">
                <p className="text-sm leading-relaxed">{translateInsight(insight)}</p>
                {insight.actionHintKey && (
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(insight.actionHintKey)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
