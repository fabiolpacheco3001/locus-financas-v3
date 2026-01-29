import { useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO, startOfDay, isWithinInterval } from 'date-fns';
import { useLocale } from '@/i18n/useLocale';

interface Transaction {
  id: string;
  date: string;
  amount: number;
  kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: string;
}

interface BalanceAreaChartProps {
  transactions: Transaction[];
  initialBalance?: number;
}

export function BalanceAreaChart({ transactions, initialBalance = 0 }: BalanceAreaChartProps) {
  const { formatCurrency } = useLocale();

  const chartData = useMemo(() => {
    const today = startOfDay(new Date());
    const thirtyDaysAgo = subDays(today, 30);
    
    // Filter confirmed transactions in last 30 days
    const relevantTxs = transactions.filter(t => {
      if (t.status !== 'confirmed') return false;
      const txDate = parseISO(t.date);
      return isWithinInterval(txDate, { start: thirtyDaysAgo, end: today });
    });

    // Group transactions by date and calculate daily balance changes
    const dailyChanges: Record<string, number> = {};
    relevantTxs.forEach(t => {
      const dateKey = format(parseISO(t.date), 'yyyy-MM-dd');
      if (!dailyChanges[dateKey]) dailyChanges[dateKey] = 0;
      
      if (t.kind === 'INCOME') {
        dailyChanges[dateKey] += Number(t.amount);
      } else if (t.kind === 'EXPENSE') {
        dailyChanges[dateKey] -= Number(t.amount);
      }
    });

    // Build chart data with running balance
    const data: { date: string; balance: number; label: string }[] = [];
    let runningBalance = initialBalance;

    for (let i = 30; i >= 0; i--) {
      const date = subDays(today, i);
      const dateKey = format(date, 'yyyy-MM-dd');
      const change = dailyChanges[dateKey] || 0;
      runningBalance += change;
      
      data.push({
        date: dateKey,
        balance: runningBalance,
        label: format(date, 'dd/MM'),
      });
    }

    return data;
  }, [transactions, initialBalance]);

  const minBalance = Math.min(...chartData.map(d => d.balance));
  const maxBalance = Math.max(...chartData.map(d => d.balance));
  const hasNegative = minBalance < 0;

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.05} />
            </linearGradient>
            <linearGradient id="balanceGradientNegative" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
              <stop offset="100%" stopColor="hsl(var(--destructive))" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis 
            dataKey="label" 
            axisLine={false}
            tickLine={false}
            tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            interval="preserveStartEnd"
            tickCount={5}
          />
          <YAxis 
            hide 
            domain={[
              Math.min(minBalance * 1.1, 0),
              maxBalance * 1.1
            ]} 
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const data = payload[0].payload;
              return (
                <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg backdrop-blur-sm">
                  <p className="text-xs text-muted-foreground">{data.label}</p>
                  <p className={`text-sm font-bold ${data.balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {formatCurrency(data.balance)}
                  </p>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="balance"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            fill="url(#balanceGradient)"
          />
          {hasNegative && (
            <Area
              type="monotone"
              dataKey={(d) => (d.balance < 0 ? d.balance : 0)}
              stroke="hsl(var(--destructive))"
              strokeWidth={2}
              fill="url(#balanceGradientNegative)"
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
