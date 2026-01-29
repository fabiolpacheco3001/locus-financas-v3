import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Loader2, PiggyBank, AlertTriangle } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import type { AccountType } from '@/types/finance';

interface AccountFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  formName: string;
  formType: AccountType;
  formBalance: string;
  formInitialBalance: string;
  formIsReserve: boolean;
  onFormNameChange: (value: string) => void;
  onFormTypeChange: (value: AccountType) => void;
  onFormBalanceChange: (value: string) => void;
  onFormInitialBalanceChange: (value: string) => void;
  onFormIsReserveChange: (value: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isPending: boolean;
}

export function AccountFormDialog({
  open,
  onOpenChange,
  editingId,
  formName,
  formType,
  formBalance,
  formInitialBalance,
  formIsReserve,
  onFormNameChange,
  onFormTypeChange,
  onFormBalanceChange,
  onFormInitialBalanceChange,
  onFormIsReserveChange,
  onSubmit,
  isPending,
}: AccountFormDialogProps) {
  const { t } = useLocale();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingId ? t('accounts.edit') : t('accounts.new')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('accounts.name')}</Label>
            <Input
              placeholder={t('accounts.namePlaceholder')}
              value={formName}
              onChange={(e) => onFormNameChange(e.target.value)}
              required
              data-testid="account-name-input"
            />
          </div>

          <div className="space-y-2">
            <Label>{t('accounts.type')}</Label>
            <Select value={formType} onValueChange={(v) => onFormTypeChange(v as AccountType)}>
              <SelectTrigger data-testid="account-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="BANK">{t('accounts.types.BANK')}</SelectItem>
                <SelectItem value="CARD">{t('accounts.types.CARD')}</SelectItem>
                <SelectItem value="CASH">{t('accounts.types.CASH')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!editingId ? (
            <div className="space-y-2">
              <Label>{t('accounts.initialBalance')}</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={formBalance}
                onChange={(e) => onFormBalanceChange(e.target.value)}
                data-testid="account-balance-input"
              />
              <p className="text-xs text-muted-foreground">
                {t('accounts.initialBalanceNote')}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label>{t('accounts.initialBalance')}</Label>
              <Input
                type="text"
                placeholder="0,00"
                value={formInitialBalance}
                onChange={(e) => onFormInitialBalanceChange(e.target.value)}
                data-testid="account-initial-balance-input"
              />
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  {t('accounts.initialBalanceWarning')}
                </AlertDescription>
              </Alert>
            </div>
          )}

          {/* Reserve/Piggy bank toggle */}
          <div className="flex items-center gap-3 rounded-lg border border-border p-3 bg-background">
            <PiggyBank className="h-5 w-5 text-primary" />
            <Label htmlFor="is-reserve" className="flex-1 cursor-pointer">
              <span className="font-medium">{t('accounts.isReserve')}</span>
              <p className="text-xs text-muted-foreground">{t('accounts.isReserveDesc')}</p>
            </Label>
            <Switch
              id="is-reserve"
              checked={formIsReserve}
              onCheckedChange={onFormIsReserveChange}
              data-testid="account-is-reserve-switch"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending} data-testid="btn-create-account">
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingId ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
