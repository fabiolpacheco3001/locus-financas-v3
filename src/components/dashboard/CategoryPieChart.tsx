import { useMemo } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useLocale } from '@/i18n/useLocale';
import { useIsMobile } from '@/hooks/use-mobile';

interface CategoryData {
  name: string;
  amount: number;
  percentage: number;
}

interface CategoryPieChartProps {
  categories: CategoryData[];
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

export function CategoryPieChart({ categories }: CategoryPieChartProps) {
  const { formatCurrency, t } = useLocale();
  const isMobile = useIsMobile();

  const chartData = useMemo(() => {
    if (categories.length === 0) return [];
    return categories.slice(0, 5).map((cat, index) => ({
      name: cat.name,
      value: cat.amount,
      percentage: cat.percentage,
      color: COLORS[index % COLORS.length],
    }));
  }, [categories]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[200px] items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('dashboard.topCategories.noExpenses')}</p>
      </div>
    );
  }

  return (
    <div className={`flex ${isMobile ? 'flex-col' : 'flex-row'} items-center gap-4 w-full`}>
      <div className={`${isMobile ? 'h-[160px] w-full' : 'h-[180px] w-[180px]'} flex-shrink-0`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={3}
              dataKey="value"
              strokeWidth={0}
            >
              {chartData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  className="transition-opacity hover:opacity-80"
                />
              ))}
            </Pie>
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const data = payload[0].payload;
                return (
                  <div className="rounded-lg border border-border bg-popover px-3 py-2 shadow-lg backdrop-blur-sm">
                    <p className="text-xs font-medium text-foreground">{data.name}</p>
                    <p className="text-sm font-bold text-primary">
                      {formatCurrency(data.value)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {data.percentage.toFixed(1)}%
                    </p>
                  </div>
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      
      <div className={`${isMobile ? 'w-full' : 'flex-1'} space-y-2`}>
        {chartData.map((cat, index) => (
          <div key={cat.name} className="flex items-center gap-2">
            <div 
              className="h-3 w-3 rounded-full flex-shrink-0" 
              style={{ backgroundColor: cat.color }}
            />
            <span className="text-sm text-foreground truncate flex-1">{cat.name}</span>
            <span className="text-xs text-muted-foreground font-medium">
              {cat.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
