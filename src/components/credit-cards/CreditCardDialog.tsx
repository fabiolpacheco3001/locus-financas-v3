import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MoneyInput } from '@/components/ui/money-input';
import { useLocale } from '@/i18n/useLocale';
import { CARD_BRANDS, CARD_COLORS, CreditCard } from '@/types/creditCards';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CreditCardDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingCard?: CreditCard | null;
  onSubmit: (data: {
    name: string;
    limit_amount: number;
    closing_day: number;
    due_day: number;
    color: string;
    brand?: string | null;
  }) => Promise<void>;
  isPending?: boolean;
}

export function CreditCardDialog({
  open,
  onOpenChange,
  editingCard,
  onSubmit,
  isPending,
}: CreditCardDialogProps) {
  const { t } = useLocale();
  
  const [name, setName] = useState('');
  const [limitAmount, setLimitAmount] = useState<number | undefined>(undefined);
  const [closingDay, setClosingDay] = useState<number>(10);
  const [dueDay, setDueDay] = useState<number>(17);
  const [color, setColor] = useState<string>(CARD_COLORS[0]);
  const [brand, setBrand] = useState<string | undefined>(undefined);

  // Reset form when dialog opens/closes or editing changes
  useEffect(() => {
    if (open && editingCard) {
      setName(editingCard.name);
      setLimitAmount(Number(editingCard.limit_amount));
      setClosingDay(editingCard.closing_day);
      setDueDay(editingCard.due_day);
      setColor(editingCard.color || CARD_COLORS[0]);
      setBrand(editingCard.brand || undefined);
    } else if (open) {
      setName('');
      setLimitAmount(undefined);
      setClosingDay(10);
      setDueDay(17);
      setColor(CARD_COLORS[0]);
      setBrand(undefined);
    }
  }, [open, editingCard]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    await onSubmit({
      name,
      limit_amount: limitAmount || 0,
      closing_day: closingDay,
      due_day: dueDay,
      color,
      brand: brand || null,
    });
    
    onOpenChange(false);
  };

  const dayOptions = Array.from({ length: 31 }, (_, i) => i + 1);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editingCard ? t('creditCards.edit') : t('creditCards.new')}
          </DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t('creditCards.name')}</Label>
            <Input
              placeholder={t('creditCards.namePlaceholder')}
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>{t('creditCards.brand')}</Label>
            <Select value={brand} onValueChange={setBrand}>
              <SelectTrigger>
                <SelectValue placeholder={t('creditCards.selectBrand')} />
              </SelectTrigger>
              <SelectContent>
                {CARD_BRANDS.map(b => (
                  <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('creditCards.limit')}</Label>
            <MoneyInput
              value={limitAmount}
              onChange={setLimitAmount}
              placeholder="5.000,00"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('creditCards.closingDay')}</Label>
              <Select value={String(closingDay)} onValueChange={(v) => setClosingDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map(day => (
                    <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('creditCards.dueDay')}</Label>
              <Select value={String(dueDay)} onValueChange={(v) => setDueDay(Number(v))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {dayOptions.map(day => (
                    <SelectItem key={day} value={String(day)}>{day}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('creditCards.color')}</Label>
            <div className="flex flex-wrap gap-2">
              {CARD_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={cn(
                    'w-8 h-8 rounded-full transition-all',
                    color === c ? 'ring-2 ring-offset-2 ring-primary' : 'hover:scale-110'
                  )}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                />
              ))}
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isPending || !name}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingCard ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
