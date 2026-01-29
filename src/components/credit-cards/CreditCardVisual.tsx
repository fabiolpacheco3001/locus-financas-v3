import { CreditCard as CreditCardIcon, Pencil, Trash2, FileText, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface CreditCardVisualProps {
  id: string;
  name: string;
  brand?: string | null;
  color: string;
  limitAmount: number;
  availableLimit: number;
  closingDay: number;
  dueDay: number;
  invoiceMonth?: string; // YYYY-MM format for display
  currentInvoiceAmount: number;
  totalLiability: number;
  onEdit?: () => void;
  onDelete?: () => void;
  onViewInvoices?: () => void;
  className?: string;
}

const brandLogos: Record<string, string> = {
  visa: '💳 VISA',
  mastercard: '🔴🟡 MC',
  elo: '🔵 ELO',
  amex: '💙 AMEX',
  hipercard: '❤️ HIPER',
};

export function CreditCardVisual({
  id,
  name,
  brand,
  color,
  limitAmount,
  availableLimit,
  closingDay,
  dueDay,
  invoiceMonth,
  currentInvoiceAmount,
  totalLiability,
  onEdit,
  onDelete,
  onViewInvoices,
  className,
}: CreditCardVisualProps) {
  const { formatCurrency } = useLocale();
  
  // Use total liability for usage calculation (shows real debt)
  const usagePercentage = limitAmount > 0 ? (totalLiability / limitAmount) * 100 : 0;
  const isOverLimit = usagePercentage > 100;
  
  // Determine if we should use light or dark text based on color brightness
  const isLightColor = (hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return (r * 299 + g * 587 + b * 114) / 1000 > 128;
  };
  
  const textColor = isLightColor(color) ? 'text-gray-900' : 'text-white';
  const mutedColor = isLightColor(color) ? 'text-gray-600' : 'text-white/70';

  return (
    <div
      className={cn(
        'relative w-full max-w-sm rounded-2xl p-5 shadow-xl transition-transform hover:scale-[1.02]',
        'backdrop-blur-sm border border-white/10',
        className
      )}
      style={{
        background: `linear-gradient(135deg, ${color} 0%, ${color}dd 50%, ${color}99 100%)`,
      }}
    >
      {/* Card chip and brand */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2">
          <div className="w-10 h-7 rounded bg-gradient-to-br from-yellow-300 to-yellow-500 opacity-80" />
          <CreditCardIcon className={cn('h-5 w-5', textColor)} />
        </div>
        <span className={cn('text-sm font-bold tracking-wider', textColor)}>
          {brand ? brandLogos[brand] || brand.toUpperCase() : ''}
        </span>
      </div>

      {/* Card number placeholder */}
      <div className={cn('text-lg font-mono tracking-widest mb-4', textColor)}>
        •••• •••• •••• ••••
      </div>

      {/* Card name */}
      <div className={cn('text-xl font-bold mb-4', textColor)}>
        {name}
      </div>

      {/* Limit info */}
      <div className="space-y-2">
        {/* Total liability (main metric) */}
        <div className="flex justify-between items-center text-sm">
          <span className={cn('flex items-center gap-1', mutedColor)}>
            Total a Pagar
            {isOverLimit && <AlertTriangle className="h-3 w-3 text-destructive" />}
          </span>
          <span className={cn(
            'font-bold text-lg',
            isOverLimit ? 'text-destructive' : textColor
          )}>
            {formatCurrency(totalLiability)}
          </span>
        </div>
        
        {/* Usage bar */}
        <div className="h-2 rounded-full bg-black/20 overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all',
              usagePercentage > 100 ? 'bg-destructive' : usagePercentage > 80 ? 'bg-amber-400' : 'bg-emerald-400'
            )}
            style={{ width: `${Math.min(usagePercentage, 100)}%` }}
          />
        </div>
        
        <div className="flex justify-between text-xs">
          <span className={mutedColor}>
            Fatura{invoiceMonth ? ` ${invoiceMonth.split('-')[1]}/${invoiceMonth.split('-')[0]}` : ''}: {formatCurrency(currentInvoiceAmount)}
          </span>
          <span className={mutedColor}>
            Limite: {formatCurrency(limitAmount)}
          </span>
        </div>
      </div>

      {/* Dates + View Invoices */}
      <div className={cn('flex justify-between items-center mt-4 pt-4 border-t border-white/20 text-xs', mutedColor)}>
        <div className="flex gap-3">
          <span>Fecha dia {closingDay}</span>
          <span>Vence dia {dueDay}</span>
        </div>
        {onViewInvoices && (
          <Button
            variant="ghost"
            size="sm"
            className={cn('h-6 px-2 text-xs', textColor, 'hover:bg-white/10')}
            onClick={(e) => {
              e.stopPropagation();
              onViewInvoices();
            }}
          >
            <FileText className="h-3 w-3 mr-1" />
            Ver Faturas
          </Button>
        )}
      </div>

      {/* Action buttons */}
      {(onEdit || onDelete) && (
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onEdit && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-background/20 hover:bg-background/30"
              onClick={(e) => {
                e.stopPropagation();
                onEdit();
              }}
            >
              <Pencil className={cn('h-4 w-4', textColor)} />
            </Button>
          )}
          {onDelete && (
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 bg-background/20 hover:bg-background/30"
              onClick={(e) => {
                e.stopPropagation();
                onDelete();
              }}
            >
              <Trash2 className={cn('h-4 w-4', textColor)} />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
