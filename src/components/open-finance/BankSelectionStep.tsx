/**
 * BankSelectionStep - Step 3 of the consent wizard
 * Select bank and initiate connection
 */

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  ArrowLeft, 
  Building2, 
  Search,
  Loader2,
  ExternalLink,
  Shield,
  Check
} from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';
import type { Bank } from '@/types/openFinance';

interface BankSelectionStepProps {
  banks: Bank[];
  selectedBank: Bank | null;
  isLoading: boolean;
  onSelectBank: (bank: Bank) => void;
  onSubmit: () => void;
  onBack: () => void;
}

export function BankSelectionStep({
  banks,
  selectedBank,
  isLoading,
  onSelectBank,
  onSubmit,
  onBack,
}: BankSelectionStepProps) {
  const { t } = useLocale();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredBanks = banks.filter(bank =>
    bank.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          <Building2 className="h-8 w-8 text-primary" />
        </div>
        <h2 className="text-2xl font-bold text-foreground">
          {t('openFinance.bankSelection.title')}
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          {t('openFinance.bankSelection.subtitle')}
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder={t('openFinance.bankSelection.searchPlaceholder')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
          data-testid="bank-search-input"
        />
      </div>

      {/* Banks Grid */}
      <div className="grid gap-3 sm:grid-cols-2 max-h-[300px] overflow-y-auto pr-1">
        {filteredBanks.map((bank, index) => {
          const isSelected = selectedBank?.id === bank.id;
          
          return (
            <motion.div
              key={bank.id}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.03 }}
            >
              <Card 
                className={cn(
                  'cursor-pointer transition-all hover:border-primary/50',
                  isSelected 
                    ? 'border-primary bg-primary/5 ring-2 ring-primary/20' 
                    : 'border-border/50 bg-card/50'
                )}
                onClick={() => onSelectBank(bank)}
                data-testid={`bank-option-${bank.id}`}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                      style={{ backgroundColor: `${bank.primaryColor}20` }}
                    >
                      {bank.logo}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">
                        {bank.name}
                      </p>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Badge 
                          variant="outline" 
                          className="text-xs h-5 border-success/30 text-success bg-success/5"
                        >
                          Open Finance
                        </Badge>
                      </div>
                    </div>
                    {isSelected && (
                      <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      {filteredBanks.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          {t('openFinance.bankSelection.noResults')}
        </div>
      )}

      {/* Selected Bank Info */}
      {selectedBank && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-primary/5 border-primary/30">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div 
                  className="w-12 h-12 rounded-lg flex items-center justify-center text-3xl"
                  style={{ backgroundColor: `${selectedBank.primaryColor}30` }}
                >
                  {selectedBank.logo}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-foreground">
                    {selectedBank.name}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    {t('openFinance.bankSelection.redirectInfo')}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Security Note */}
      <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <Shield className="h-4 w-4 text-success" />
        <span>{t('openFinance.bankSelection.securityNote')}</span>
      </div>

      {/* Actions */}
      <div className="flex justify-between pt-4">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="gap-2"
          disabled={isLoading}
        >
          <ArrowLeft className="h-4 w-4" />
          {t('common.back')}
        </Button>
        <Button 
          onClick={onSubmit}
          disabled={!selectedBank || isLoading}
          className="gap-2 min-w-[160px]"
          data-testid="consent-submit-button"
        >
          {isLoading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('openFinance.bankSelection.connecting')}
            </>
          ) : (
            <>
              {t('openFinance.bankSelection.cta')}
              <ExternalLink className="h-4 w-4" />
            </>
          )}
        </Button>
      </div>
    </motion.div>
  );
}
