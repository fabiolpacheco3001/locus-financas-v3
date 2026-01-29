import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, ArrowLeftRight } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface Transaction {
  id: string;
  description?: string | null;
  amount: number;
  kind: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  status: string;
  date: string;
  category?: { name: string } | null;
  account?: { name: string } | null;
  to_account?: { name: string } | null;
}

interface TransactionTimelineProps {
  transactions: Transaction[];
}

export function TransactionTimeline({ transactions }: TransactionTimelineProps) {
  const { formatCurrency, formatDate, t } = useLocale();

  if (transactions.length === 0) {
    return (
      <div className="flex items-center justify-center py-8">
        <p className="text-sm text-muted-foreground">
          {t('dashboard.recentTransactions.noTransactions')}
        </p>
      </div>
    );
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-5 top-0 bottom-0 w-px bg-border" />
      
      <div className="space-y-1">
        {transactions.map((tx, index) => {
          const Icon = tx.kind === 'INCOME' 
            ? TrendingUp 
            : tx.kind === 'EXPENSE' 
            ? TrendingDown 
            : ArrowLeftRight;

          const label = tx.kind === 'TRANSFER'
            ? `${tx.account?.name} → ${tx.to_account?.name}`
            : tx.description || tx.category?.name || t('common.transaction');

          return (
            <motion.div
              key={tx.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ 
                duration: 0.3, 
                delay: index * 0.05,
                ease: [0.25, 0.46, 0.45, 0.94]
              }}
              className="relative flex items-center gap-4 py-3 pl-0 pr-2"
            >
              {/* Icon bubble */}
              <div
                className={cn(
                  "relative z-10 flex h-10 w-10 items-center justify-center rounded-full flex-shrink-0",
                  tx.kind === 'INCOME' && "bg-success/20 text-success",
                  tx.kind === 'EXPENSE' && "bg-destructive/20 text-destructive",
                  tx.kind === 'TRANSFER' && "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-4 w-4" />
              </div>
              
              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {label}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(tx.date, 'dd MMM')}
                </p>
              </div>
              
              {/* Amount */}
              <span
                className={cn(
                  "text-sm font-bold tabular-nums flex-shrink-0",
                  tx.status === 'planned' && "text-warning",
                  tx.status !== 'planned' && tx.kind === 'INCOME' && "text-success",
                  tx.status !== 'planned' && tx.kind === 'EXPENSE' && "text-destructive",
                  tx.kind === 'TRANSFER' && "text-muted-foreground"
                )}
              >
                {tx.kind === 'INCOME' ? '+' : tx.kind === 'EXPENSE' ? '-' : ''}
                {formatCurrency(Number(tx.amount))}
              </span>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
