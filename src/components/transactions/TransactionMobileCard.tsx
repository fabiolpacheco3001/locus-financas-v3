import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Transaction, TransactionKind } from '@/types/finance';
import { useLocale } from '@/i18n/useLocale';
import {
  CreditCard,
  Clock,
  Calendar,
  CheckCircle2,
  X,
  Pencil,
  Trash2,
  Copy,
  Check,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowLeftRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface TransactionMobileCardProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onConfirm: (transaction: Transaction) => void;
}

const kindIcons: Record<TransactionKind, React.ElementType> = {
  INCOME: TrendingUp,
  EXPENSE: TrendingDown,
  TRANSFER: ArrowLeftRight,
};

const kindColors: Record<TransactionKind, string> = {
  INCOME: 'bg-success/10 text-success border-success/20',
  EXPENSE: 'bg-destructive/10 text-destructive border-destructive/20',
  TRANSFER: 'bg-primary/10 text-primary border-primary/20',
};

export const TransactionMobileCard = memo(function TransactionMobileCard({
  transaction: tx,
  onEdit,
  onDelete,
  onDuplicate,
  onConfirm,
}: TransactionMobileCardProps) {
  const { t, formatCurrency, formatDate } = useLocale();
  const isCancelled = tx.status === 'cancelled';
  const KindIcon = kindIcons[tx.kind];

  const getAmountColorClass = () => {
    if (isCancelled) return 'text-muted-foreground line-through';
    if (tx.status === 'planned') {
      return tx.kind === 'EXPENSE' ? 'text-amber-600 dark:text-amber-400' : 'text-primary/70';
    }
    if (tx.kind === 'INCOME') return 'text-success';
    if (tx.kind === 'EXPENSE') return 'text-destructive';
    return 'text-muted-foreground';
  };

  const getDescription = () => {
    if (tx.description) return tx.description;
    if (tx.kind === 'TRANSFER') return `${tx.account?.name} → ${tx.to_account?.name}`;
    if (tx.subcategory) return `${tx.category?.name} › ${tx.subcategory.name}`;
    return tx.category?.name || '-';
  };

  const getCategoryLabel = () => {
    if (tx.kind === 'TRANSFER') return t('transactions.kind.transfer');
    if (tx.subcategory) return `${tx.category?.name} › ${tx.subcategory.name}`;
    return tx.category?.name || t('common.noCategory');
  };

  return (
    <div
      className={cn(
        'flex items-start gap-3 rounded-xl border bg-card p-4 transition-all',
        isCancelled ? 'opacity-60 bg-muted/30' : 'hover:shadow-md'
      )}
      data-testid={`transaction-card-${tx.id}`}
    >
      {/* Left: Category Icon */}
      <div
        className={cn(
          'flex h-10 w-10 shrink-0 items-center justify-center rounded-full border',
          kindColors[tx.kind]
        )}
      >
        <KindIcon className="h-5 w-5" />
      </div>

      {/* Middle: Description + Category + Date */}
      <div className="flex-1 min-w-0">
        <p className={cn('font-medium truncate', isCancelled && 'line-through text-muted-foreground')}>
          {getDescription()}
          {tx.installment_number && tx.installment_total && (
            <Badge
              variant="outline"
              className="ml-2 text-[10px] py-0 px-1 border-primary/50 text-primary"
            >
              {tx.installment_number}/{tx.installment_total}
            </Badge>
          )}
        </p>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">
          {getCategoryLabel()}
        </p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-xs text-muted-foreground">
            {formatDate(tx.date, 'dd MMM')}
          </span>
          {/* Status badges */}
          {isCancelled && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-muted-foreground/50 text-muted-foreground">
              <X className="h-2.5 w-2.5 mr-0.5" />
              {t('status.cancelled')}
            </Badge>
          )}
          {!isCancelled && tx.status === 'confirmed' && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-success/50 text-success bg-success/10">
              <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />
              {tx.kind === 'EXPENSE' ? t('status.paid') : t('transactions.statusLabels.confirmed')}
            </Badge>
          )}
          {!isCancelled && tx.status === 'planned' && tx.kind === 'EXPENSE' && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400">
              <Calendar className="h-2.5 w-2.5 mr-0.5" />
              {t('status.toPay')}
            </Badge>
          )}
          {!isCancelled && tx.status === 'planned' && tx.kind === 'INCOME' && (
            <Badge variant="outline" className="text-[10px] py-0 px-1.5 border-primary/50 text-primary bg-primary/10">
              <Clock className="h-2.5 w-2.5 mr-0.5" />
              {t('transactions.planned.futureIncome')}
            </Badge>
          )}
        </div>
      </div>

      {/* Right: Amount + Actions */}
      <div className="flex flex-col items-end gap-2 shrink-0">
        <span className={cn('font-semibold text-sm', getAmountColorClass())}>
          {tx.kind === 'INCOME' ? '+' : tx.kind === 'EXPENSE' ? '-' : ''}
          {formatCurrency(Number(tx.amount))}
        </span>
        
        {/* Quick actions */}
        <div className="flex items-center gap-0.5">
          {!isCancelled && tx.status === 'planned' && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-success hover:bg-success/10"
              onClick={() => onConfirm(tx)}
              data-testid={`btn-confirm-${tx.id}`}
            >
              <Check className="h-3.5 w-3.5" />
            </Button>
          )}
          {!isCancelled && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => onEdit(tx)}
                data-testid={`btn-edit-${tx.id}`}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:bg-destructive/10"
                onClick={() => onDelete(tx)}
                data-testid={`btn-delete-${tx.id}`}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});
