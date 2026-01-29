/**
 * OpenFinanceConsentWizard - Main wizard container
 * 3-step consent flow for Open Finance connections
 */

import { AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Zap } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { useOpenFinanceConsent } from '@/hooks/useOpenFinanceConsent';
import { BenefitsStep } from './BenefitsStep';
import { PermissionsStep } from './PermissionsStep';
import { BankSelectionStep } from './BankSelectionStep';
import { ConsentSuccess } from './ConsentSuccess';

interface OpenFinanceConsentWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OpenFinanceConsentWizard({ 
  open, 
  onOpenChange 
}: OpenFinanceConsentWizardProps) {
  const { t } = useLocale();
  
  const {
    state,
    availableBanks,
    nextStep,
    prevStep,
    selectBank,
    togglePermission,
    setPrivacyAccepted,
    setNotificationsEnabled,
    submitConsent,
    reset,
  } = useOpenFinanceConsent();

  const handleClose = () => {
    onOpenChange(false);
    // Reset after animation completes
    setTimeout(reset, 300);
  };

  const getStepProgress = () => {
    if (state.step === 'success' || state.step === 'error') return 100;
    return ((state.step as number) / 3) * 100;
  };

  const getStepLabel = () => {
    if (state.step === 'success') return t('openFinance.wizard.complete');
    if (state.step === 'error') return t('openFinance.wizard.error');
    return t('openFinance.wizard.stepLabel', { current: state.step, total: 3 });
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent 
        className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto"
        data-testid="open-finance-consent-wizard"
      >
        <DialogHeader className="space-y-4">
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-primary" />
              {t('openFinance.wizard.title')}
            </DialogTitle>
            <Badge variant="outline" className="text-xs border-primary/30 text-primary">
              {getStepLabel()}
            </Badge>
          </div>
          
          {/* Progress Bar */}
          {state.step !== 'success' && state.step !== 'error' && (
            <Progress value={getStepProgress()} className="h-1" />
          )}
        </DialogHeader>

        <AnimatePresence mode="wait">
          {state.step === 1 && (
            <BenefitsStep 
              key="benefits"
              onNext={nextStep} 
            />
          )}

          {state.step === 2 && (
            <PermissionsStep
              key="permissions"
              permissions={state.permissions}
              privacyAccepted={state.privacyAccepted}
              notificationsEnabled={state.notificationsEnabled}
              onTogglePermission={togglePermission}
              onPrivacyChange={setPrivacyAccepted}
              onNotificationsChange={setNotificationsEnabled}
              onNext={nextStep}
              onBack={prevStep}
            />
          )}

          {state.step === 3 && (
            <BankSelectionStep
              key="bank-selection"
              banks={availableBanks}
              selectedBank={state.selectedBank}
              isLoading={state.isLoading}
              onSelectBank={selectBank}
              onSubmit={submitConsent}
              onBack={prevStep}
            />
          )}

          {state.step === 'success' && state.selectedBank && (
            <ConsentSuccess
              key="success"
              bankName={state.selectedBank.name}
              bankLogo={state.selectedBank.logo}
              onClose={handleClose}
            />
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
