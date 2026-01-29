import { useTranslation } from 'react-i18next';
import { useCallback, useMemo } from 'react';
import { format as dateFnsFormat, formatDistanceToNow as dateFnsFormatDistanceToNow } from 'date-fns';
import { ptBR, es, enUS } from 'date-fns/locale';
import { LOCALE_CONFIG, SupportedLocale, setStoredLocale } from './index';
import { toDateSafe } from '@/lib/dateOnly';

const DATE_LOCALES = {
  'pt-BR': ptBR,
  'es': es,
  'en': enUS
};

export function useLocale() {
  const { i18n, t } = useTranslation();
  
  const currentLocale = (i18n.language || 'pt-BR') as SupportedLocale;
  const config = LOCALE_CONFIG[currentLocale] || LOCALE_CONFIG['pt-BR'];
  const dateLocale = DATE_LOCALES[currentLocale] || ptBR;

  const changeLocale = useCallback((locale: SupportedLocale) => {
    setStoredLocale(locale);
    i18n.changeLanguage(locale);
  }, [i18n]);

  const formatCurrency = useCallback((value: number, currency?: string) => {
    return new Intl.NumberFormat(config.numberFormat, {
      style: 'currency',
      currency: currency || config.currency
    }).format(value);
  }, [config]);

  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(config.numberFormat, options).format(value);
  }, [config]);

  const formatDate = useCallback((date: Date | string, formatStr: string = 'PP') => {
    const dateObj = toDateSafe(date);
    return dateFnsFormat(dateObj, formatStr, { locale: dateLocale });
  }, [dateLocale]);

  const formatDateShort = useCallback((date: Date | string) => {
    // en-US uses MM/DD/YYYY, others use DD/MM/YYYY
    const formatStr = currentLocale === 'en' ? 'MM/dd/yyyy' : 'dd/MM/yyyy';
    return formatDate(date, formatStr);
  }, [formatDate, currentLocale]);

  const formatDateLong = useCallback((date: Date | string) => {
    return formatDate(date, 'PPP');
  }, [formatDate]);

  const formatMonthYear = useCallback((date: Date | string) => {
    const dateObj = toDateSafe(date);
    // Use locale-appropriate format
    const formatStr = currentLocale === 'en' ? 'MMMM yyyy' : "MMMM 'de' yyyy";
    return dateFnsFormat(dateObj, formatStr, { locale: dateLocale });
  }, [dateLocale, currentLocale]);

  const formatRelativeTime = useCallback((date: Date | string) => {
    const dateObj = toDateSafe(date);
    return dateFnsFormatDistanceToNow(dateObj, { 
      locale: dateLocale,
      addSuffix: true 
    });
  }, [dateLocale]);

  return useMemo(() => ({
    t,
    currentLocale,
    changeLocale,
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateShort,
    formatDateLong,
    formatMonthYear,
    formatRelativeTime,
    dateLocale,
    config
  }), [
    t,
    currentLocale,
    changeLocale,
    formatCurrency,
    formatNumber,
    formatDate,
    formatDateShort,
    formatDateLong,
    formatMonthYear,
    formatRelativeTime,
    dateLocale,
    config
  ]);
}
