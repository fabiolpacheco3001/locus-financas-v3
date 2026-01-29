import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Building, Banknote, Star, PiggyBank, AlertTriangle, Pencil, Trash2, Wallet } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import type { AccountType } from '@/types/finance';
import { cn } from '@/lib/utils';

const typeIcons: Record<AccountType, React.ComponentType<{ className?: string }>> = {
  BANK: Building,
  CASH: Banknote,
  CARD: Wallet,
};

export interface AccountWithBalance {
  id: string;
  name: string;
  type: AccountType;
  is_active: boolean;
  is_primary: boolean;
  is_reserve?: boolean;
  current_balance: number;
  initial_balance?: number;
  calculated_balance: number;
  saved_balance?: number;
  transaction_count?: number;
  breakdown?: {
    initialBalance: number;
    totalIncome: number;
    totalExpense: number;
    transfersIn: number;
    transfersOut: number;
  };
}

interface AccountCardProps {
  account: AccountWithBalance;
  onViewDetails: (id: string) => void;
  onEdit: (account: AccountWithBalance) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

export function AccountCard({
  account,
  onViewDetails,
  onEdit,
  onDelete,
  onSetPrimary,
}: AccountCardProps) {
  const { t, formatCurrency } = useLocale();
  
  const Icon = typeIcons[account.type] || Building;
  const isReserve = account.is_reserve;
  const hasDiscrepancy = Math.abs(account.calculated_balance - (account.saved_balance ?? 0)) > 0.01;

  return (
    <Card className="group" data-testid={`account-card-${account.id}`}>
      <CardContent className="relative flex items-center justify-between gap-3 p-4">
        
        {/* LEFT: ICON (Fixed Anchor) */}
        <div
          className={cn(
            "flex h-10 w-10 shrink-0 items-center justify-center rounded-full",
            isReserve
              ? "bg-amber-500/10"
              : account.is_primary
                ? "bg-primary/20"
                : "bg-primary/10"
          )}
        >
          {isReserve ? (
            <PiggyBank className="h-5 w-5 text-amber-500" />
          ) : (
            <Icon className="h-5 w-5 text-primary" />
          )}
        </div>

        {/* MIDDLE: INFO (Fluid Width - Stacked Layout) */}
        <div
          className="flex min-w-0 flex-1 cursor-pointer flex-col justify-center overflow-hidden"
          onClick={() => onViewDetails(account.id)}
        >
          {/* Line 1: Name (Truncated) */}
          <span className="truncate font-semibold text-foreground">
            {account.name}
          </span>

          {/* Line 2: Badges */}
          <div className="mt-1 flex flex-wrap items-center gap-1">
            {/* Default Type Label if no badges */}
            {!account.is_primary && !isReserve && !hasDiscrepancy && (
              <span className="text-xs text-muted-foreground">
                {t(`accounts.types.${account.type}`)}
              </span>
            )}
            {account.is_primary && (
              <Badge variant="outline" className="border-amber-300 text-xs text-amber-600">
                <Star className="mr-1 h-3 w-3 fill-amber-500" />
                {t('common.primary')}
              </Badge>
            )}
            {isReserve && (
              <Badge variant="secondary" className="text-xs">
                <PiggyBank className="mr-1 h-3 w-3" />
                {t('accounts.reserve')}
              </Badge>
            )}
            {hasDiscrepancy && (
              <Badge variant="destructive" className="text-xs">
                <AlertTriangle className="mr-1 h-3 w-3" />
                {t('accounts.discrepancy')}
              </Badge>
            )}
          </div>
        </div>

        {/* RIGHT: BALANCE (Fixed Anchor) */}
        <div className="flex shrink-0 items-center gap-2">
          <span
            className={cn(
              "text-lg font-semibold",
              account.calculated_balance >= 0 ? "text-foreground" : "text-destructive"
            )}
          >
            {formatCurrency(account.calculated_balance)}
          </span>

          {/* Action Buttons (Floating on Mobile, Inline on Desktop) */}
          <div className="hidden group-hover:flex items-center gap-1 absolute right-2 top-1/2 -translate-y-1/2 bg-card border border-border shadow-md rounded-lg p-1 sm:static sm:bg-transparent sm:border-0 sm:shadow-none sm:translate-y-0 sm:p-0 z-10">
            {!account.is_primary && (
              <Button variant="ghost" size="icon" onClick={() => onSetPrimary(account.id)}>
                <Star className="h-4 w-4 text-amber-500" />
              </Button>
            )}
            <Button variant="ghost" size="icon" onClick={() => onEdit(account)}>
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={() => onDelete(account.id)}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        </div>

      </CardContent>
    </Card>
  );
}
