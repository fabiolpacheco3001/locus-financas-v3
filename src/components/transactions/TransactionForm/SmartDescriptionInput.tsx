import { useState, useRef, useEffect, KeyboardEvent } from 'react';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { Pencil, Sparkles, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';
import { usePredictTransaction } from '@/hooks/usePredictTransaction';
import { useDescriptionSuggestions } from '@/hooks/useDescriptionSuggestions';
import { PaymentMethod } from '@/types/creditCards';

interface SmartDescriptionInputProps {
  value: string;
  onChange: (value: string) => void;
  onPredictionSelect?: (prediction: {
    categoryId: string | null;
    subcategoryId: string | null;
    accountId: string | null;
    paymentMethod: PaymentMethod | null;
    description: string | null;
  }) => void;
  memberId?: string;
  accountId?: string;
  categoryId?: string;
  disabled?: boolean;
  inputRef?: React.RefObject<HTMLInputElement>;
}

export function SmartDescriptionInput({
  value,
  onChange,
  onPredictionSelect,
  memberId,
  accountId,
  categoryId,
  disabled,
  inputRef: externalInputRef,
}: SmartDescriptionInputProps) {
  // ===== HOOKS (TODOS NO INÍCIO) =====
  const { t } = useLocale();
  
  // Get prediction from RPC
  const { prediction = null, hasPrediction = false, isLoading = false } = usePredictTransaction({
    description: value || '',
    enabled: value ? value.length >= 2 : false,
  });

  // Get description suggestions from history
  const { suggestions = [] } = useDescriptionSuggestions({
    memberId,
    accountId,
    categoryId,
    searchTerm: value || '',
  });

  // ===== ESTADOS E REFS =====
  const [open, setOpen] = useState(false);
  const internalInputRef = useRef<HTMLInputElement>(null);
  const inputRef = externalInputRef || internalInputRef;
  
  // Category protection: track when category was manually changed to prevent overwriting
  const categoryProtectionUntil = useRef<number>(0);
  const lastCategoryId = useRef<string | undefined>(categoryId);
  
  // ===== EFFECTS =====
  // Detect manual category changes and apply 5-second protection
  useEffect(() => {
    if (categoryId && categoryId !== lastCategoryId.current) {
      // User changed category - protect for 5 seconds
      categoryProtectionUntil.current = Date.now() + 5000;
    }
    lastCategoryId.current = categoryId;
  }, [categoryId]);

  // Open popover when typing and there are suggestions
  useEffect(() => {
    const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
    const hasValue = value && value.length >= 2;
    if (hasValue && (safeSuggestions.length > 0 || hasPrediction)) {
      setOpen(true);
    } else {
      setOpen(false);
    }
  }, [value, suggestions, hasPrediction]);

  const handleSelect = (selectedDescription: string) => {
    onChange(selectedDescription);
    setOpen(false);

    // If we have a prediction and it matches, apply it
    if (prediction && prediction.description === selectedDescription && onPredictionSelect) {
      // Check if category is protected (user manually changed it recently)
      const isCategoryProtected = Date.now() < categoryProtectionUntil.current;
      const isCategoryDirty = categoryId !== undefined && categoryId !== '';
      
      onPredictionSelect({
        // Only apply category prediction if not protected and not already set
        categoryId: (isCategoryProtected || isCategoryDirty) ? null : prediction.categoryId,
        subcategoryId: (isCategoryProtected || isCategoryDirty) ? null : prediction.subcategoryId,
        accountId: prediction.accountId,
        paymentMethod: prediction.paymentMethod,
        description: prediction.description,
      });
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false);
    }
    // Let Enter propagate if popover is closed
    const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
    if (e.key === 'Enter' && open && (safeSuggestions.length > 0 || hasPrediction)) {
      e.preventDefault();
      // Select first suggestion
      if (hasPrediction && prediction?.description) {
        handleSelect(prediction.description);
      } else if (safeSuggestions.length > 0) {
        handleSelect(safeSuggestions[0]);
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div className="relative">
          <Pencil className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              const safeSuggestions = Array.isArray(suggestions) ? suggestions : [];
              const hasValue = value && value.length >= 2;
              if (hasValue && (safeSuggestions.length > 0 || hasPrediction)) {
                setOpen(true);
              }
            }}
            placeholder={t('transactions.form.descriptionPlaceholder')}
            className="pl-10 pr-10"
            disabled={disabled}
            data-testid="form-description"
            autoComplete="off"
          />
          {isLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}
          {hasPrediction && !isLoading && (
            <Sparkles className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
          )}
        </div>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border shadow-lg z-50" 
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command className="bg-popover">
          <CommandList>
            {/* Smart Prediction (highlighted) */}
            {hasPrediction && prediction?.description && (
              <CommandGroup heading={t('transactions.smartSuggestion')}>
                <CommandItem
                  value={prediction.description}
                  onSelect={() => handleSelect(prediction.description!)}
                  className="cursor-pointer bg-primary/5 border border-primary/20 mb-1"
                >
                  <Sparkles className="mr-2 h-4 w-4 text-primary" />
                  <div className="flex-1">
                    <span className="font-medium">{prediction.description}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      ({prediction.matchCount}x)
                    </span>
                  </div>
                  <Check className="h-4 w-4 text-primary opacity-50" />
                </CommandItem>
              </CommandGroup>
            )}

            {/* Recent Descriptions */}
            {Array.isArray(suggestions) && suggestions.length > 0 && (
              <CommandGroup heading={t('transactions.recentDescriptions')}>
                {suggestions
                  .filter(s => s !== prediction?.description) // Don't duplicate the prediction
                  .slice(0, 4)
                  .map((suggestion) => (
                    <CommandItem
                      key={suggestion}
                      value={suggestion}
                      onSelect={() => handleSelect(suggestion)}
                      className="cursor-pointer"
                    >
                      {suggestion}
                    </CommandItem>
                  ))}
              </CommandGroup>
            )}

            {!hasPrediction && (!Array.isArray(suggestions) || suggestions.length === 0) && (
              <CommandEmpty>{t('common.noResults')}</CommandEmpty>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
