/**
 * BenefitsStep - Step 1 of the consent wizard
 * Explains why we need Open Finance data
 */

import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  Shield, 
  Zap, 
  PieChart,
  ArrowRight,
  Sparkles
} from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface BenefitsStepProps {
  onNext: () => void;
}

const benefits = [
  {
    icon: TrendingUp,
    titleKey: 'openFinance.benefits.projections.title',
    descriptionKey: 'openFinance.benefits.projections.description',
    color: 'text-success',
    bgColor: 'bg-success/10',
  },
  {
    icon: PieChart,
    titleKey: 'openFinance.benefits.insights.title',
    descriptionKey: 'openFinance.benefits.insights.description',
    color: 'text-primary',
    bgColor: 'bg-primary/10',
  },
  {
    icon: Zap,
    titleKey: 'openFinance.benefits.automation.title',
    descriptionKey: 'openFinance.benefits.automation.description',
    color: 'text-warning',
    bgColor: 'bg-warning/10',
  },
  {
    icon: Shield,
    titleKey: 'openFinance.benefits.security.title',
    descriptionKey: 'openFinance.benefits.security.description',
    color: 'text-info',
    bgColor: 'bg-info/10',
  },
];

export function BenefitsStep({ onNext }: BenefitsStepProps) {
  const { t } = useLocale();

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
          <Sparkles className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('openFinance.benefits.title')}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t('openFinance.benefits.subtitle')}
        </p>
      </div>

      {/* Benefits Grid */}
      <div className="grid gap-4 sm:grid-cols-2">
        {benefits.map((benefit, index) => (
          <motion.div
            key={benefit.titleKey}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card className="h-full bg-card/50 backdrop-blur-sm border-border/50 hover:border-primary/30 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={cn('p-2 rounded-lg', benefit.bgColor)}>
                    <benefit.icon className={cn('h-5 w-5', benefit.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-sm">
                      {t(benefit.titleKey)}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t(benefit.descriptionKey)}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Trust Badge */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-4 w-4 text-success" />
        <span>{t('openFinance.benefits.trustBadge')}</span>
      </div>

      {/* Action */}
      <div className="flex justify-center pt-4">
        <Button 
          size="lg" 
          onClick={onNext}
          className="gap-2 min-w-[200px]"
          data-testid="consent-benefits-next"
        >
          {t('openFinance.benefits.cta')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </motion.div>
  );
}
