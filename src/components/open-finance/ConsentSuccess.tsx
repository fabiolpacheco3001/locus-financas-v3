/**
 * ConsentSuccess - Success state after consent flow
 */

import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Zap,
  ArrowRight,
  RefreshCw
} from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';

interface ConsentSuccessProps {
  bankName: string;
  bankLogo: string;
  onClose: () => void;
}

export function ConsentSuccess({ bankName, bankLogo, onClose }: ConsentSuccessProps) {
  const { t } = useLocale();

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center space-y-6 py-8"
    >
      {/* Success Animation */}
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ 
          type: 'spring', 
          stiffness: 200, 
          damping: 15,
          delay: 0.2 
        }}
        className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10"
      >
        <CheckCircle2 className="h-10 w-10 text-success" />
      </motion.div>

      {/* Title */}
      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-foreground">
          {t('openFinance.success.title')}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t('openFinance.success.subtitle')}
        </p>
      </div>

      {/* Connected Bank */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="inline-flex items-center gap-3 px-4 py-3 rounded-xl bg-card border border-border/50"
      >
        <span className="text-3xl">{bankLogo}</span>
        <div className="text-left">
          <p className="font-semibold text-foreground">{bankName}</p>
          <div className="flex items-center gap-1">
            <Badge variant="outline" className="text-xs border-warning/50 text-warning bg-warning/5 gap-1">
              <RefreshCw className="h-3 w-3" />
              {t('openFinance.success.syncingStatus')}
            </Badge>
          </div>
        </div>
      </motion.div>

      {/* What Happens Next */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="space-y-3 text-left max-w-sm mx-auto"
      >
        <h3 className="font-semibold text-foreground text-center">
          {t('openFinance.success.nextSteps.title')}
        </h3>
        <div className="space-y-2">
          {[1, 2, 3].map((step) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-semibold text-primary">{step}</span>
              </div>
              <p className="text-sm text-muted-foreground">
                {t(`openFinance.success.nextSteps.step${step}`)}
              </p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Sync Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-primary">
        <Zap className="h-4 w-4" />
        <span>{t('openFinance.success.autoSyncInfo')}</span>
      </div>

      {/* Action */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
      >
        <Button 
          size="lg" 
          onClick={onClose}
          className="gap-2 min-w-[200px]"
          data-testid="consent-success-close"
        >
          {t('openFinance.success.cta')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </motion.div>
    </motion.div>
  );
}
