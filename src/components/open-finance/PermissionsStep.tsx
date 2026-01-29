/**
 * PermissionsStep - Step 2 of the consent wizard
 * Shows what permissions are being requested
 */

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  ArrowRight, 
  Eye, 
  Wallet, 
  Receipt,
  CreditCard,
  TrendingUp,
  Shield,
  Lock,
  ExternalLink
} from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';
import type { ConsentPermission } from '@/types/openFinance';

interface PermissionsStepProps {
  permissions: ConsentPermission[];
  privacyAccepted: boolean;
  notificationsEnabled: boolean;
  onTogglePermission: (permission: ConsentPermission) => void;
  onPrivacyChange: (accepted: boolean) => void;
  onNotificationsChange: (enabled: boolean) => void;
  onNext: () => void;
  onBack: () => void;
}

const permissionDetails: Record<ConsentPermission, {
  icon: React.ComponentType<{ className?: string }>;
  labelKey: string;
  descriptionKey: string;
  required?: boolean;
}> = {
  ACCOUNTS_READ: {
    icon: Wallet,
    labelKey: 'openFinance.permissions.accounts.label',
    descriptionKey: 'openFinance.permissions.accounts.description',
    required: true,
  },
  BALANCES_READ: {
    icon: Eye,
    labelKey: 'openFinance.permissions.balances.label',
    descriptionKey: 'openFinance.permissions.balances.description',
    required: true,
  },
  TRANSACTIONS_READ: {
    icon: Receipt,
    labelKey: 'openFinance.permissions.transactions.label',
    descriptionKey: 'openFinance.permissions.transactions.description',
    required: true,
  },
  CREDIT_CARDS_READ: {
    icon: CreditCard,
    labelKey: 'openFinance.permissions.creditCards.label',
    descriptionKey: 'openFinance.permissions.creditCards.description',
  },
  INVESTMENTS_READ: {
    icon: TrendingUp,
    labelKey: 'openFinance.permissions.investments.label',
    descriptionKey: 'openFinance.permissions.investments.description',
  },
};

export function PermissionsStep({
  permissions,
  privacyAccepted,
  notificationsEnabled,
  onTogglePermission,
  onPrivacyChange,
  onNotificationsChange,
  onNext,
  onBack,
}: PermissionsStepProps) {
  const { t } = useLocale();

  const allPermissions: ConsentPermission[] = [
    'ACCOUNTS_READ',
    'BALANCES_READ',
    'TRANSACTIONS_READ',
    'CREDIT_CARDS_READ',
    'INVESTMENTS_READ',
  ];

  const canProceed = privacyAccepted && permissions.includes('ACCOUNTS_READ') && permissions.includes('BALANCES_READ');

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="text-center space-y-2">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Lock className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('openFinance.permissions.title')}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t('openFinance.permissions.subtitle')}
        </p>
      </div>

      {/* Read-Only Badge */}
      <div className="flex justify-center">
        <Badge variant="outline" className="gap-1 border-success/50 text-success bg-success/5">
          <Eye className="h-3 w-3" />
          {t('openFinance.permissions.readOnlyBadge')}
        </Badge>
      </div>

      {/* Permissions List */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-4 space-y-3">
          {allPermissions.map((permission, index) => {
            const details = permissionDetails[permission];
            const isChecked = permissions.includes(permission);
            const Icon = details.icon;

            return (
              <motion.div
                key={permission}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className={cn(
                  'flex items-start gap-3 p-3 rounded-lg border transition-colors',
                  isChecked 
                    ? 'border-primary/30 bg-primary/5' 
                    : 'border-border/50 bg-muted/30'
                )}
              >
                <Checkbox
                  id={permission}
                  checked={isChecked}
                  onCheckedChange={() => !details.required && onTogglePermission(permission)}
                  disabled={details.required}
                  className="mt-0.5"
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <Icon className={cn('h-4 w-4', isChecked ? 'text-primary' : 'text-muted-foreground')} />
                    <Label 
                      htmlFor={permission} 
                      className="font-medium text-sm cursor-pointer"
                    >
                      {t(details.labelKey)}
                    </Label>
                    {details.required && (
                      <Badge variant="secondary" className="text-xs">
                        {t('openFinance.permissions.required')}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t(details.descriptionKey)}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </CardContent>
      </Card>

      {/* Privacy Toggle */}
      <Card className="bg-card/50 backdrop-blur-sm border-border/50">
        <CardContent className="p-4 space-y-4">
          {/* Privacy Acceptance */}
          <div className="flex items-start gap-3">
            <Checkbox
              id="privacy-accepted"
              checked={privacyAccepted}
              onCheckedChange={(checked) => onPrivacyChange(checked === true)}
              data-testid="consent-privacy-checkbox"
            />
            <div className="flex-1">
              <Label htmlFor="privacy-accepted" className="text-sm cursor-pointer">
                {t('openFinance.permissions.privacyLabel')}
              </Label>
              <a 
                href="#" 
                className="flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                onClick={(e) => {
                  e.preventDefault();
                  // TODO: Open data manifesto modal
                  window.alert('Locus Data Manifesto - LGPD/CDC Compliance');
                }}
              >
                <Shield className="h-3 w-3" />
                {t('openFinance.permissions.dataManifesto')}
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>

          {/* Notifications Toggle */}
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="notifications" className="text-sm">
                {t('openFinance.permissions.notificationsLabel')}
              </Label>
              <p className="text-xs text-muted-foreground">
                {t('openFinance.permissions.notificationsDescription')}
              </p>
            </div>
            <Switch
              id="notifications"
              checked={notificationsEnabled}
              onCheckedChange={onNotificationsChange}
            />
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <Button 
          onClick={onNext}
          disabled={!canProceed}
          className="gap-2"
          data-testid="consent-permissions-next"
        >
          {t('openFinance.permissions.cta')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
