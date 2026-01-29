import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { ArrowLeftRight, ChevronDown, RefreshCw, Loader2, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import type { AccountWithBalance } from './AccountCard';

interface AccountDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  account: AccountWithBalance | null;
  onSync: (id: string) => void;
  isSyncing: boolean;
}

export function AccountDetailDialog({
  open,
  onOpenChange,
  account,
  onSync,
  isSyncing,
}: AccountDetailDialogProps) {
  const { t, formatCurrency } = useLocale();

  if (!account) return null;

  const savedBalance = account.saved_balance ?? 0;
  const hasDiscrepancy = Math.abs(account.calculated_balance - savedBalance) > 0.01;

  const handleSync = () => {
    if (confirm(t('accounts.syncBalanceConfirm'))) {
      onSync(account.id);
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="h-5 w-5" />
            {account.name} - {t('accounts.details')}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 max-h-[70vh] overflow-y-auto">
          {/* Balance Comparison */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border p-3">
              <p className="text-xs text-muted-foreground">{t('accounts.initialBalance')}</p>
              <p className="text-lg font-semibold">
                {formatCurrency(account.breakdown?.initialBalance || 0)}
              </p>
            </div>
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-xs text-muted-foreground">{t('accounts.savedInDb')}</p>
              <p className="text-lg font-semibold text-muted-foreground">
                {formatCurrency(savedBalance)}
              </p>
            </div>
            <div className="rounded-lg border p-3 border-primary">
              <p className="text-xs text-muted-foreground">{t('accounts.calculatedBalance')}</p>
              <p className={`text-lg font-semibold ${account.calculated_balance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                {formatCurrency(account.calculated_balance)}
              </p>
            </div>
          </div>

          {/* Balance Breakdown - Collapsible */}
          <Collapsible>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between text-sm font-medium">
                <span className="flex items-center gap-2">
                  📊 {t('accounts.viewCalculationDetails')}
                </span>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="rounded-lg border p-4 space-y-1 text-sm font-mono mt-2">
                <div className="flex justify-between text-green-600 dark:text-green-400">
                  <span>(+) {t('accounts.breakdown.income')}</span>
                  <span>{formatCurrency(account.breakdown?.totalIncome || 0)}</span>
                </div>
                <div className="flex justify-between text-destructive">
                  <span>(-) {t('accounts.breakdown.expense')}</span>
                  <span>{formatCurrency(account.breakdown?.totalExpense || 0)}</span>
                </div>
                <div className="flex justify-between text-blue-600 dark:text-blue-400">
                  <span>(+) {t('accounts.breakdown.transfersIn')}</span>
                  <span>{formatCurrency(account.breakdown?.transfersIn || 0)}</span>
                </div>
                <div className="flex justify-between text-orange-600 dark:text-orange-400">
                  <span>(-) {t('accounts.breakdown.transfersOut')}</span>
                  <span>{formatCurrency(account.breakdown?.transfersOut || 0)}</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-bold">
                  <span>(=) {t('accounts.breakdown.result')}</span>
                  <span className={account.calculated_balance >= 0 ? 'text-foreground' : 'text-destructive'}>
                    {formatCurrency(account.calculated_balance)}
                  </span>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {/* Discrepancy Alert */}
          {hasDiscrepancy && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {t('accounts.discrepancyAlert', { 
                  diff: formatCurrency(Math.abs(account.calculated_balance - savedBalance))
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Transaction Count */}
          <div className="rounded-lg border p-3 bg-muted/50">
            <p className="text-sm">
              {t('accounts.basedOnTransactions', { count: account.transaction_count ?? 0 })}
            </p>
          </div>

          {/* Sync Balance Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button 
                variant="outline" 
                className="w-full"
                onClick={handleSync}
                disabled={isSyncing}
                data-testid="btn-sync-balance"
              >
                {isSyncing ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCw className="mr-2 h-4 w-4" />
                )}
                {t('accounts.syncBalance')}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{t('accounts.syncBalanceTooltip')}</p>
            </TooltipContent>
          </Tooltip>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
