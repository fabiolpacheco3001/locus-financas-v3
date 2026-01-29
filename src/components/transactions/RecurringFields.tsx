import { useLocale } from '@/i18n/useLocale';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Repeat } from 'lucide-react';
import { format } from 'date-fns';

interface RecurringFieldsProps {
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

export function RecurringFields({
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
}: RecurringFieldsProps) {
  const { t } = useLocale();

  const currentMonth = format(new Date(), 'yyyy-MM');

  return (
    <div className="space-y-4">
      {/* Recurring toggle */}
      <div className="flex items-center gap-3 rounded-lg border p-3 bg-primary/5 border-primary/20">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10">
          <Repeat className="h-4 w-4 text-primary" />
        </div>
        <Label htmlFor="recurring-toggle" className="flex-1 cursor-pointer">
          <span className="font-medium">{t('transactions.recurring.toggle')}</span>
          <p className="text-xs text-muted-foreground">{t('transactions.recurring.toggleDesc')}</p>
        </Label>
        <Switch
          id="recurring-toggle"
          checked={isRecurring}
          onCheckedChange={onIsRecurringChange}
          disabled={disabled}
        />
      </div>

      {/* Recurring config fields */}
      {isRecurring && (
        <div className="space-y-4 p-4 rounded-lg border border-primary/20 bg-primary/5">
          {/* Day of month */}
          <div className="space-y-2">
            <Label>{t('transactions.recurring.dayOfMonth')}</Label>
            <Select
              value={String(dayOfMonth)}
              onValueChange={(v) => onDayOfMonthChange(Number(v))}
              disabled={disabled}
            >
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label>{t('transactions.recurring.startMonth')}</Label>
            <Input
              type="month"
              value={startMonth}
              onChange={(e) => onStartMonthChange(e.target.value)}
              disabled={disabled}
            />
          </div>

          {/* End month toggle and field */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id="has-end-month"
                checked={hasEndMonth}
                onCheckedChange={onHasEndMonthChange}
                disabled={disabled}
              />
              <Label htmlFor="has-end-month" className="cursor-pointer text-sm">
                {t('transactions.recurring.endMonth')}
              </Label>
            </div>
            {hasEndMonth ? (
              <Input
                type="month"
                value={endMonth}
                onChange={(e) => onEndMonthChange(e.target.value)}
                min={startMonth}
                disabled={disabled}
              />
            ) : (
              <p className="text-xs text-muted-foreground italic">
                {t('transactions.recurring.noEnd')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
