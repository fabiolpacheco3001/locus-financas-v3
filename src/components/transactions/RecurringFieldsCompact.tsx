import { useLocale } from '@/i18n/useLocale';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Repeat } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';

interface RecurringFieldsCompactProps {
  isRecurring: boolean;
  onIsRecurringChange: (value: boolean) => void;
  startMonth: string;
  onStartMonthChange: (value: string) => void;
  endMonth: string;
  onEndMonthChange: (value: string) => void;
  hasEndMonth: boolean;
  onHasEndMonthChange: (value: boolean) => void;
  dayOfMonth: number;
  onDayOfMonthChange: (value: number) => void;
  disabled?: boolean;
}

/**
 * Compact recurring fields component for "Smart Input" flow.
 * Shows only a simple checkbox by default, with advanced options in a collapsible.
 */
export function RecurringFieldsCompact({
  isRecurring,
  onIsRecurringChange,
  startMonth,
  onStartMonthChange,
  endMonth,
  onEndMonthChange,
  hasEndMonth,
  onHasEndMonthChange,
  dayOfMonth,
  onDayOfMonthChange,
  disabled = false,
}: RecurringFieldsCompactProps) {
  const { t } = useLocale();
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <div className="space-y-2">
      {/* Simple checkbox toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="recurring-checkbox"
          checked={isRecurring}
          onCheckedChange={(checked) => onIsRecurringChange(checked === true)}
          disabled={disabled}
        />
        <Label 
          htmlFor="recurring-checkbox" 
          className="flex items-center gap-1.5 cursor-pointer text-sm text-muted-foreground"
        >
          <Repeat className="h-3.5 w-3.5" />
          {t('transactions.recurring.repeatMonthly')}
        </Label>
      </div>

      {/* Advanced options - only shown when recurring is enabled */}
      {isRecurring && (
        <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
          <CollapsibleTrigger className="flex items-center gap-1 text-xs text-primary hover:underline">
            <ChevronDown className={`h-3 w-3 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
            {t('transactions.recurring.advancedOptions')}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-3 space-y-3">
            <div className="p-3 rounded-lg border border-border bg-muted/30 space-y-3">
              {/* Day of month */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('transactions.recurring.dayOfMonth')}</Label>
                  <Select
                    value={String(dayOfMonth)}
                    onValueChange={(v) => onDayOfMonthChange(Number(v))}
                    disabled={disabled}
                  >
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 28 }, (_, i) => i + 1).map((day) => (
                        <SelectItem key={day} value={String(day)}>
                          {day}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Start month */}
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('transactions.recurring.startMonth')}</Label>
                  <Input
                    type="month"
                    value={startMonth}
                    onChange={(e) => onStartMonthChange(e.target.value)}
                    disabled={disabled}
                    className="h-8 text-sm"
                  />
                </div>
              </div>

              {/* End month */}
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="has-end-month-compact"
                    checked={hasEndMonth}
                    onCheckedChange={(checked) => onHasEndMonthChange(checked === true)}
                    disabled={disabled}
                  />
                  <Label htmlFor="has-end-month-compact" className="cursor-pointer text-xs">
                    {t('transactions.recurring.setEndMonth')}
                  </Label>
                </div>
                {hasEndMonth && (
                  <Input
                    type="month"
                    value={endMonth}
                    onChange={(e) => onEndMonthChange(e.target.value)}
                    min={startMonth}
                    disabled={disabled}
                    className="h-8 text-sm"
                  />
                )}
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}
