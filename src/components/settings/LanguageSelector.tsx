import { useLocale } from '@/i18n/useLocale';
import { SUPPORTED_LOCALES, LOCALE_CONFIG, SupportedLocale } from '@/i18n';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Globe } from 'lucide-react';

interface LanguageSelectorProps {
  showLabel?: boolean;
  className?: string;
}

export function LanguageSelector({ showLabel = true, className }: LanguageSelectorProps) {
  const { t, currentLocale, changeLocale } = useLocale();

  return (
    <div className={className}>
      {showLabel && (
        <label className="text-sm font-medium text-foreground mb-2 block">
          {t('settings.language')}
        </label>
      )}
      <Select value={currentLocale} onValueChange={(value) => changeLocale(value as SupportedLocale)}>
        <SelectTrigger className="w-full">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4" />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {SUPPORTED_LOCALES.map((locale) => (
            <SelectItem key={locale} value={locale}>
              {LOCALE_CONFIG[locale].label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
