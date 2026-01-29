import { memo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Transaction, TransactionKind } from '@/types/finance';
import { useLocale } from '@/i18n/useLocale';
import { useIsMobile } from '@/hooks/use-mobile';
import { TransactionMobileCard } from './TransactionMobileCard';
import {
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  Trash2,
  Copy,
  CreditCard,
  Clock,
  Calendar,
  CheckCircle2,
  X,
  Info,
  EyeOff,
  CalendarClock,
  Check,
  FlaskConical,
} from 'lucide-react';

// ========== TYPES ==========
export type SortField = 'date' | 'category' | 'description' | 'kind' | 'amount';
export type SortDirection = 'asc' | 'desc';

interface TransactionTableProps {
  transactions: Transaction[];
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  onEdit: (transaction: Transaction) => void;
  onDelete: (transaction: Transaction) => void;
  onDuplicate: (transaction: Transaction) => void;
  onConfirm: (transaction: Transaction) => void;
  onPostpone?: (transaction: Transaction) => void;
  onSimulateInstallments?: (transaction: Transaction) => void;
  onSimulateDeletion?: (transaction: Transaction) => void;
}

// ========== CONSTANTS ==========
const kindColors: Record<TransactionKind, string> = {
  INCOME: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  EXPENSE: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  TRANSFER: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
};

// ========== HELPER COMPONENTS ==========
interface SortableHeaderProps {
  field: SortField;
  currentField: SortField;
  direction: SortDirection;
  onClick: (field: SortField) => void;
  children: React.ReactNode;
  className?: string;
}

const SortableHeader = memo(({ field, currentField, direction, onClick, children, className = '' }: SortableHeaderProps) => (
  <TableHead
    className={`cursor-pointer select-none ${className}`}
    onClick={() => onClick(field)}
    data-testid={`sort-header-${field}`}
  >
    <div className="flex items-center gap-1">
      {children}
      {currentField === field ? (
        direction === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 text-muted-foreground/50" />
      )}
    </div>
  </TableHead>
));
SortableHeader.displayName = 'SortableHeader';

// ========== MAIN COMPONENT ==========
export const TransactionTable = memo(function TransactionTable({
  transactions,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
  onDuplicate,
  onConfirm,
  onPostpone,
  onSimulateInstallments,
  onSimulateDeletion,
}: TransactionTableProps) {
  const { t, formatCurrency, formatDate } = useLocale();
  const isMobile = useIsMobile();

  const kindLabels: Record<TransactionKind, string> = {
    INCOME: t('transactions.kind.income'),
    EXPENSE: t('transactions.kind.expense'),
    TRANSFER: t('transactions.kind.transfer'),
  };

  // Mobile: Render vertical card list
  if (isMobile) {
    return (
      <div className="space-y-3" data-testid="transaction-table">
        {transactions.map((tx) => (
          <TransactionMobileCard
            key={tx.id}
            transaction={tx}
            onEdit={onEdit}
            onDelete={onDelete}
            onDuplicate={onDuplicate}
            onConfirm={onConfirm}
          />
        ))}
        {transactions.length === 0 && (
          <div className="py-8 text-center text-muted-foreground">
            {t('transactions.emptyState')}
          </div>
        )}
      </div>
    );
  }

  // Desktop: Render full table
  return (
    <div className="rounded-lg border overflow-hidden" data-testid="transaction-table">
      <Table>
        <TableHeader>
          <TableRow className="bg-muted/50">
            <SortableHeader field="date" currentField={sortField} direction={sortDirection} onClick={onSort}>
              {t('transactions.sort.date')}
            </SortableHeader>
            <SortableHeader field="category" currentField={sortField} direction={sortDirection} onClick={onSort}>
              {t('transactions.sort.category')}
            </SortableHeader>
            <SortableHeader field="description" currentField={sortField} direction={sortDirection} onClick={onSort}>
              {t('transactions.sort.description')}
            </SortableHeader>
            <SortableHeader field="kind" currentField={sortField} direction={sortDirection} onClick={onSort}>
              {t('transactions.sort.type')}
            </SortableHeader>
            <TableHead className="hidden lg:table-cell">
              {t('creditCards.paymentMethod.label')}
            </TableHead>
            <SortableHeader
              field="amount"
              currentField={sortField}
              direction={sortDirection}
              onClick={onSort}
              className="text-right"
            >
              {t('transactions.sort.amount')}
            </SortableHeader>
            <TableHead className="text-right">{t('common.actions')}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((tx) => {
            const isCancelled = tx.status === 'cancelled';
            return (
              <TableRow
                key={tx.id}
                className={isCancelled ? 'opacity-50 bg-muted/30' : ''}
                data-testid={`transaction-row-${tx.id}`}
              >
                {/* 1) Data do lançamento */}
                <TableCell className={`whitespace-nowrap ${isCancelled ? 'line-through text-muted-foreground' : ''}`}>
                  <div className="flex items-center gap-1">
                    {formatDate(tx.date, 'dd/MM/yy')}
                    {tx.member && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help flex-shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <p className="text-sm">{t('transactions.member')}: {tx.member.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>

                {/* 2) Categoria */}
                <TableCell className={isCancelled ? 'line-through text-muted-foreground' : ''}>
                  {tx.kind === 'TRANSFER' ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1">
                      <span>{tx.category?.name}</span>
                      {tx.category?.archived_at && (
                        <Badge variant="outline" className="text-xs py-0 px-1 text-muted-foreground">
                          {t('categories.archived')}
                        </Badge>
                      )}
                      {tx.subcategory && (
                        <>
                          <span className="text-muted-foreground">/</span>
                          <span>{tx.subcategory.name}</span>
                          {tx.subcategory.archived_at && (
                            <Badge variant="outline" className="text-xs py-0 px-1 text-muted-foreground">
                              {t('categories.archived')}
                            </Badge>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </TableCell>

                {/* 3) Descrição - Smart Display: fallback to category if empty */}
                <TableCell className={isCancelled ? 'line-through text-muted-foreground' : ''}>
                  <div>
                    <p className="flex items-center gap-1">
                      {tx.description ? (
                        tx.description
                      ) : tx.kind === 'TRANSFER' ? (
                        '-'
                      ) : (
                        <span className="italic text-muted-foreground">
                          {tx.subcategory 
                            ? `${tx.category?.name} › ${tx.subcategory.name}` 
                            : tx.category?.name || '-'}
                        </span>
                      )}
                      {tx.installment_number && tx.installment_total && (
                        <Badge
                          variant="outline"
                          className={`ml-1 text-xs ${
                            isCancelled
                              ? 'border-muted-foreground/50 text-muted-foreground'
                              : 'border-primary/50 text-primary bg-primary/10'
                          }`}
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          {tx.installment_number}/{tx.installment_total}
                        </Badge>
                      )}
                    </p>
                    {tx.kind === 'TRANSFER' && (
                      <p className="text-xs text-muted-foreground">
                        {tx.account?.name} → {tx.to_account?.name}
                      </p>
                    )}
                  </div>
                </TableCell>

                {/* 4) Tipo + Status */}
                <TableCell>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge
                      className={isCancelled ? 'bg-muted text-muted-foreground' : kindColors[tx.kind]}
                      variant="secondary"
                    >
                      {kindLabels[tx.kind]}
                    </Badge>
                    {/* Status badges */}
                    {isCancelled && (
                      <Badge variant="outline" className="border-muted-foreground/50 text-muted-foreground bg-muted">
                        <X className="h-3 w-3 mr-1" />
                        {t('status.cancelled')}
                      </Badge>
                    )}
                    {!isCancelled && tx.status === 'confirmed' && (
                      <Badge
                        variant="outline"
                        className="border-emerald-500/50 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 dark:text-emerald-400"
                      >
                        <CheckCircle2 className="h-3 w-3 mr-1" />
                        {tx.kind === 'EXPENSE' ? t('status.paid') : t('transactions.statusLabels.confirmed')}
                      </Badge>
                    )}
                    {!isCancelled && tx.status === 'planned' && tx.kind === 'INCOME' && (
                      <Badge variant="outline" className="border-primary/50 text-primary bg-primary/10">
                        <Clock className="h-3 w-3 mr-1" />
                        {t('transactions.planned.futureIncome')}
                      </Badge>
                    )}
                    {!isCancelled && tx.status === 'planned' && tx.kind === 'EXPENSE' && (
                      <Badge
                        variant="outline"
                        className="border-amber-500/50 text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400"
                      >
                        <Calendar className="h-3 w-3 mr-1" />
                        {t('status.toPay')}
                      </Badge>
                    )}
                    {!isCancelled && tx.kind === 'EXPENSE' && tx.expense_type === 'fixed' && (
                      <Badge
                        variant="outline"
                        className="border-slate-500/50 text-slate-600 bg-slate-50 dark:bg-slate-900/20 dark:text-slate-400"
                      >
                        {t('transactions.expenseTypes.fixed')}
                      </Badge>
                    )}
                  </div>
                </TableCell>

                {/* 5) Forma de Pagamento */}
                <TableCell className="hidden lg:table-cell">
                  {tx.kind !== 'EXPENSE' || !tx.payment_method ? (
                    <span className="text-muted-foreground">-</span>
                  ) : (
                    <Badge variant="outline" className="text-xs">
                      {tx.payment_method === 'credit_card' && <CreditCard className="h-3 w-3 mr-1" />}
                      {t(`creditCards.paymentMethod.${tx.payment_method}`)}
                    </Badge>
                  )}
                </TableCell>


                {/* 7) Valor */}
                <TableCell
                  className={`text-right font-medium ${
                    isCancelled
                      ? 'line-through text-muted-foreground'
                      : tx.status === 'planned'
                      ? tx.kind === 'EXPENSE'
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-primary/70'
                      : tx.kind === 'INCOME'
                      ? 'text-emerald-600 dark:text-emerald-400'
                      : tx.kind === 'EXPENSE'
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-muted-foreground'
                  }`}
                >
                  <div className="flex items-center justify-end gap-1">
                    <span>
                      {tx.kind === 'INCOME' ? '+' : tx.kind === 'EXPENSE' ? '-' : ''}
                      {formatCurrency(Number(tx.amount))}
                    </span>
                    {/* Audit tooltip */}
                    {(tx.confirmed_at || tx.cancelled_at) && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <span className="cursor-help">
                              {tx.cancelled_at ? (
                                <X className="h-3.5 w-3.5 text-muted-foreground/60" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-emerald-500/60" />
                              )}
                            </span>
                          </TooltipTrigger>
                          <TooltipContent className="z-50">
                            <div className="text-xs space-y-1">
                              {tx.confirmed_at && (
                                <p>
                                  {t('transactions.confirmedAt')}: {formatDate(tx.confirmed_at, 'dd/MM/yy HH:mm')}
                                  {tx.confirmed_by_member && ` (${tx.confirmed_by_member.name})`}
                                </p>
                              )}
                              {tx.cancelled_at && (
                                <p>
                                  {t('transactions.cancelledAt')}: {formatDate(tx.cancelled_at, 'dd/MM/yy HH:mm')}
                                  {tx.cancelled_by_member && ` (${tx.cancelled_by_member.name})`}
                                </p>
                              )}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </TableCell>

                {/* 8) Ações */}
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {/* Confirm button for planned transactions */}
                    {!isCancelled && tx.status === 'planned' && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onConfirm(tx)}
                        title={tx.kind === 'EXPENSE' ? t('status.markAsPaid') : t('transactions.actions.confirm')}
                        className="text-emerald-600 hover:text-emerald-700 hover:bg-emerald-100 dark:hover:bg-emerald-900/30"
                        data-testid={`btn-confirm-${tx.id}`}
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Postpone button for planned EXPENSE */}
                    {!isCancelled && tx.status === 'planned' && tx.kind === 'EXPENSE' && onPostpone && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onPostpone(tx)}
                        title={t('transactions.actions.postpone')}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                        data-testid={`btn-postpone-${tx.id}`}
                      >
                        <CalendarClock className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Simulate installments button */}
                    {!isCancelled && tx.status === 'planned' && tx.kind === 'EXPENSE' && onSimulateInstallments && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSimulateInstallments(tx)}
                        title={t('simulation.simulateInstallments')}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                        data-testid={`btn-simulate-installments-${tx.id}`}
                      >
                        <CreditCard className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Simulate deletion button */}
                    {!isCancelled && tx.status === 'planned' && tx.kind === 'EXPENSE' && onSimulateDeletion && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => onSimulateDeletion(tx)}
                        title={t('simulation.simulateDeletion')}
                        className="text-amber-600 hover:text-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/30"
                        data-testid={`btn-simulate-deletion-${tx.id}`}
                      >
                        <EyeOff className="h-4 w-4" />
                      </Button>
                    )}
                    {/* Standard action buttons */}
                    {!isCancelled && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDuplicate(tx)}
                          title={t('transactions.actions.duplicate')}
                          data-testid={`btn-duplicate-${tx.id}`}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onEdit(tx)}
                          title={t('common.edit')}
                          data-testid={`btn-edit-${tx.id}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => onDelete(tx)}
                          title={t('common.delete')}
                          data-testid={`btn-delete-${tx.id}`}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
});
