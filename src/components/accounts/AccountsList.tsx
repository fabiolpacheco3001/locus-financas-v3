import { Building, Banknote } from 'lucide-react';
import { AccountCard, type AccountWithBalance } from './AccountCard';
import { useLocale } from '@/i18n/useLocale';

interface AccountsListProps {
  bankAccounts: AccountWithBalance[];
  cashAccounts: AccountWithBalance[];
  onViewDetails: (id: string) => void;
  onEdit: (account: AccountWithBalance) => void;
  onDelete: (id: string) => void;
  onSetPrimary: (id: string) => void;
}

export function AccountsList({
  bankAccounts,
  cashAccounts,
  onViewDetails,
  onEdit,
  onDelete,
  onSetPrimary,
}: AccountsListProps) {
  const { t } = useLocale();

  return (
    <div className="space-y-6" data-testid="accounts-list">
      {bankAccounts.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Building className="h-5 w-5" />
            {t('accounts.sections.banks')}
          </h2>
          <div className="space-y-2">
            {bankAccounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onDelete={onDelete}
                onSetPrimary={onSetPrimary}
              />
            ))}
          </div>
        </div>
      )}

      {cashAccounts.length > 0 && (
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Banknote className="h-5 w-5" />
            {t('accounts.sections.cash')}
          </h2>
          <div className="space-y-2">
            {cashAccounts.map(account => (
              <AccountCard
                key={account.id}
                account={account}
                onViewDetails={onViewDetails}
                onEdit={onEdit}
                onDelete={onDelete}
                onSetPrimary={onSetPrimary}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
