import { FormEvent, useEffect, useState, useRef, useMemo, KeyboardEvent } from 'react';
import { Controller, UseFormReturn } from 'react-hook-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { HeroAmountInput } from './HeroAmountInput';
import { QuickChips } from './QuickChips';
import { SmartDescriptionInput } from './SmartDescriptionInput';
import { MobileSelector } from './MobileSelector';
import { InstallmentFields } from '@/components/transactions/InstallmentFields';
import { PaymentMethod, calculateInvoiceMonth, getInvoiceDueDate } from '@/types/creditCards';
import { TransactionKind } from '@/types/finance';
import { 
  Loader2, AlertTriangle, Calendar as CalendarIcon, CreditCard, AlertCircle, 
  Copy, Tag, Wallet, RefreshCw, ChevronDown, Settings2, User
} from 'lucide-react';
import { safeSelectValue, cn } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { toLocalISOString } from '@/lib/dateOnly';
import { supabase } from '@/integrations/supabase/client';
import { TransactionFormValues } from './useTransactionForm';
import { toast } from 'sonner';

// Interfaces Originais Restauradas
interface Account { id: string; name: string; type?: string; }
interface Category { id: string; name: string; icon?: string | null; archived_at?: string | null; type?: 'income' | 'expense' | string; }
interface Subcategory { id: string; name: string; archived_at?: string | null; }
interface Member { id: string; name: string; }
interface CreditCard { id: string; name: string; color: string; closing_day: number; due_day: number; }
interface BudgetWarning { message: string; type: string; percentage?: number; }
interface CategorySuggestion { categoryId: string; categoryName: string; subcategoryId?: string; subcategoryName?: string; }

interface TransactionFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;
  form: UseFormReturn<TransactionFormValues>;
  
  // States do Hook
  formKind: TransactionKind;
  setFormKind: (kind: TransactionKind) => void;
  formAccountId: string | undefined;
  setFormAccountId: (id: string | undefined) => void;
  formToAccountId: string | undefined;
  setFormToAccountId: (id: string | undefined) => void;
  formCategoryId: string | undefined;
  setFormCategoryId: (id: string | undefined) => void;
  formSubcategoryId: string | undefined;
  setFormSubcategoryId: (id: string | undefined) => void;
  formAmount: number | undefined;
  setFormAmount: (amount: number | undefined) => void;
  formDate: string;
  setFormDate: (date: string) => void;
  formDescription: string;
  setFormDescription: (desc: string) => void;
  formMemberId: string | undefined;
  setFormMemberId: (id: string | undefined) => void;
  formIsPlanned: boolean;
  setFormIsPlanned: (planned: boolean) => void;
  
  isEditingConfirmed: boolean;
  isEditingPastMonth: boolean;
  isFieldsLocked: boolean;

  formIsInstallment: boolean;
  setFormIsInstallment: (isInstallment: boolean) => void;
  formInstallmentCount: number;
  setFormInstallmentCount: (count: number) => void;
  formInstallmentDueDate: string;
  setFormInstallmentDueDate: (date: string) => void;

  formIsRecurring: boolean;
  setFormIsRecurring: (isRecurring: boolean) => void;
  formRecurringStartMonth: string;
  setFormRecurringStartMonth: (month: string) => void;
  formRecurringEndMonth: string;
  setFormRecurringEndMonth: (month: string) => void;
  formHasEndMonth: boolean;
  setFormHasEndMonth: (has: boolean) => void;
  formDayOfMonth: number;
  setFormDayOfMonth: (day: number) => void;

  formPaymentMethod: PaymentMethod;
  setFormPaymentMethod: (method: PaymentMethod) => void;
  formCreditCardId: string | undefined;
  setFormCreditCardId: (id: string | undefined) => void;

  accounts: Account[];
  selectableCategories: Category[];
  selectableSubcategories: Subcategory[];
  members: Member[];
  creditCards: CreditCard[];

  budgetWarning: BudgetWarning | null;
  descriptionSuggestions: string[];
  categorySuggestion: CategorySuggestion | null;
  showCategorySuggestion: boolean;

  amountInputRef: React.RefObject<HTMLInputElement>;
  justSavedTransaction: any;
  onCreateSimilar: () => void;
  onClose: () => void;

  // A função de ouro (Opcional para não quebrar Tipagem antiga, mas obrigatória na prática)
  submitTransaction?: () => Promise<boolean>;
  
  // Props legado (mantidas para não quebrar a chamada no pai, mas ignoradas)
  onSubmit?: any;
  isMutationPending?: boolean;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  editingId,
  form,
  formKind,
  setFormKind,
  formAccountId,
  setFormAccountId,
  formToAccountId,
  setFormToAccountId,
  formCategoryId,
  setFormCategoryId,
  formSubcategoryId,
  setFormSubcategoryId,
  formAmount,
  setFormAmount,
  formDate,
  setFormDate,
  formDescription,
  setFormDescription,
  formMemberId,
  setFormMemberId,
  formIsPlanned,
  setFormIsPlanned,
  isEditingConfirmed,
  isEditingPastMonth,
  isFieldsLocked,
  formIsInstallment,
  setFormIsInstallment,
  formInstallmentCount,
  setFormInstallmentCount,
  formInstallmentDueDate,
  setFormInstallmentDueDate,
  formIsRecurring,
  setFormIsRecurring,
  formRecurringStartMonth,
  setFormRecurringStartMonth,
  formRecurringEndMonth,
  setFormRecurringEndMonth,
  formHasEndMonth,
  setFormHasEndMonth,
  formDayOfMonth,
  setFormDayOfMonth,
  formPaymentMethod,
  setFormPaymentMethod,
  formCreditCardId,
  setFormCreditCardId,
  accounts,
  selectableCategories,
  selectableSubcategories,
  members,
  creditCards,
  budgetWarning,
  descriptionSuggestions,
  categorySuggestion,
  showCategorySuggestion,
  amountInputRef,
  justSavedTransaction,
  onCreateSimilar,
  onClose,
  submitTransaction, // <--- A NOVA FUNÇÃO CHEGA AQUI
}: TransactionFormDialogProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [openPayment, setOpenPayment] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  const [isLocalSubmitting, setIsLocalSubmitting] = useState(false);
  
  // Refs para controle manual de UI
  const userChangedPaymentMethod = useRef(false);
  const userChangedAccount = useRef(false);
  const userChangedCategory = useRef(false);

  // Reset manual flags when modal opens
  useEffect(() => {
    if (open && !editingId) {
      userChangedPaymentMethod.current = false;
      userChangedAccount.current = false;
      userChangedCategory.current = false;
    }
  }, [open, editingId]);

  // FIX: Auto-status based on date selection
  useEffect(() => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const isFutureDate = formDate > todayStr;
    
    if (formKind === 'INCOME') {
      setFormIsPlanned(false);
      return;
    }
    
    if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card') {
      setFormIsPlanned(false);
      return;
    }
    
    if (isFutureDate) {
      setFormIsPlanned(true);
    } else {
      setFormIsPlanned(false);
    }
  }, [formDate, formPaymentMethod, formKind, setFormIsPlanned]);

  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // --- LÓGICA DE SALVAMENTO BLINDADA ---
  const handleSecureClick = async (e: React.MouseEvent) => {
    // 1. Previne comportamento padrão do HTML Form
    e.preventDefault();
    e.stopPropagation();

    if (!submitTransaction) {
        toast.error("Erro interno: Função de salvar não conectada.");
        return;
    }

    // 2. Feedback Visual
    setIsLocalSubmitting(true);

    try {
        // 3. Chama a função do Hook (que já tem a lógica RPC e Cast)
        const success = await submitTransaction();
        if (success) {
            onOpenChange(false);
        }
    } catch (error) {
        console.error(error);
    } finally {
        setIsLocalSubmitting(false);
    }
  };

  // UX Helpers
  const handleAmountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      descriptionInputRef.current?.focus();
    }
  };

  const handlePredictionSelect = (prediction: any) => {
    if (prediction.categoryId) setFormCategoryId(prediction.categoryId);
    if (prediction.subcategoryId) setFormSubcategoryId(prediction.subcategoryId);
    if (prediction.accountId) setFormAccountId(prediction.accountId);
    if (prediction.paymentMethod) setFormPaymentMethod(prediction.paymentMethod);
  };

  const handleQuickChipSelect = async (description: string) => {
    if (description.length >= 2) {
      try {
        const { data, error } = await supabase.rpc('predict_transaction_details', { p_description: description });
        if (!error && data) {
           const p = data as any;
           handlePredictionSelect({
             categoryId: p.category_id,
             subcategoryId: p.subcategory_id,
             accountId: p.account_id,
             paymentMethod: p.payment_method
           });
        }
      } catch (err) { console.error(err); }
    }
    setTimeout(() => amountInputRef.current?.focus(), 50);
  };

  const formattedDate = formDate ? format(new Date(formDate + 'T12:00:00'), 'dd/MM/yyyy') : t('transactions.today');
  const getCalendarLocale = () => {
    const lang = t('common.languageCode') || 'pt-BR';
    return lang.startsWith('en') ? enUS : lang.startsWith('es') ? es : ptBR;
  };
  const selectedDate = formDate ? new Date(formDate + 'T12:00:00') : new Date();

  const getKindTitle = () => {
    switch (formKind) {
      case 'EXPENSE': return t('transactions.kind.expense');
      case 'INCOME': return t('transactions.kind.income');
      case 'TRANSFER': return t('transactions.kind.transfer');
    }
  };

  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'credit_card': return <CreditCard className="h-4 w-4" />;
      case 'pix': return <span className="text-sm">💠</span>;
      case 'cash': return <span className="text-sm">💵</span>;
      case 'boleto': return <span className="text-sm">📄</span>;
      default: return <Wallet className="h-4 w-4" />;
    }
  };

  // Listas para seletores
  const categoryItems = useMemo(() => {
    const filtered = selectableCategories.filter(c => {
      if (!c.id) return false;
      if (formKind === 'INCOME') return c.type === 'income' || !c.type;
      if (formKind === 'EXPENSE') return c.type === 'expense' || !c.type || c.type === 'income';
      return false;
    });
    return filtered.map(c => ({
      id: c.id,
      name: c.name,
      badge: c.archived_at ? t('categories.archived') : undefined,
    }));
  }, [selectableCategories, formKind, t]);

  const paymentMethodItems = [
    { id: 'debit', name: t('creditCards.paymentMethod.debit'), icon: <Wallet className="h-4 w-4" /> },
    { id: 'credit_card', name: t('creditCards.paymentMethod.credit_card'), icon: <CreditCard className="h-4 w-4" /> },
    { id: 'pix', name: t('creditCards.paymentMethod.pix'), icon: <span className="text-sm">💠</span> },
    { id: 'cash', name: t('creditCards.paymentMethod.cash'), icon: <span className="text-sm">💵</span> },
    { id: 'boleto', name: t('creditCards.paymentMethod.boleto'), icon: <span className="text-sm">📄</span> },
  ];

  const accountItems = accounts.filter(a => a.id).map(a => ({ id: a.id, name: a.name }));
  const selectedAccount = accounts.find(a => a.id === formAccountId);
  const isCardExpense = formKind === 'EXPENSE' && selectedAccount?.type === 'CARD';
  const selectedCard = creditCards.find(c => c.id === formCreditCardId);

  return (
    <Dialog open={open} onOpenChange={(v) => { if(!v) onClose(); onOpenChange(v); }}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" data-testid="transaction-form-dialog">
        {/* HEADER LIMPO E ORIGINAL */}
        <DialogHeader className="p-4 pb-3 flex-shrink-0 space-y-0">
          <DialogTitle className="text-lg font-semibold pr-8">
            {editingId ? t('transactions.edit') : getKindTitle()}
          </DialogTitle>
          
          {isEditingPastMonth && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CalendarIcon className="h-3 w-3" /> {t('transactions.warnings.pastMonthShort')}
            </p>
          )}
          {isEditingConfirmed && !isEditingPastMonth && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" /> {t('transactions.warnings.confirmedShort')}
            </p>
          )}
          
          {!editingId && (
            <div className="pt-3">
              <Tabs value={formKind} onValueChange={(v) => {
                  setFormKind(v as TransactionKind);
                  if (v !== 'EXPENSE') { setFormCategoryId(undefined); setFormSubcategoryId(undefined); }
                }} className="w-full">
                <TabsList className="w-full h-9 p-1">
                  <TabsTrigger value="EXPENSE" className="flex-1 text-sm h-7">{t('transactions.kind.expenseShort')}</TabsTrigger>
                  <TabsTrigger value="INCOME" className="flex-1 text-sm h-7">{t('transactions.kind.incomeShort')}</TabsTrigger>
                  <TabsTrigger value="TRANSFER" className="flex-1 text-sm h-7">{t('transactions.kind.transferShort')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </DialogHeader>

        {/* CORPO DO FORM (Sem onSubmit na tag form para evitar validação nativa) */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            
            {/* HERO AMOUNT */}
            <div className="py-6 border-b border-border/50">
              <Controller
                name="amount"
                control={form.control}
                render={({ field }) => (
                  <HeroAmountInput
                    ref={(el) => { amountInputRef.current = el; field.ref(el); }}
                    value={field.value}
                    onChange={(val) => { field.onChange(val); setFormAmount(val); }}
                    autoFocus={!editingId}
                    onKeyDown={handleAmountKeyDown}
                  />
                )}
              />
            </div>

            {/* DESCRIÇÃO E CHIPS */}
            <div className="space-y-3">
              <SmartDescriptionInput
                value={formDescription}
                onChange={setFormDescription}
                onPredictionSelect={handlePredictionSelect}
                memberId={formMemberId}
                accountId={formAccountId}
                categoryId={formCategoryId}
                inputRef={descriptionInputRef}
              />
              <QuickChips 
                onSelect={setFormDescription}
                onSelectComplete={handleQuickChipSelect}
                currentValue={formDescription}
              />
            </div>

            {/* GRID PRINCIPAL */}
            <div className="grid grid-cols-2 gap-2">
              {/* DATA */}
              <Popover>
                <PopoverTrigger asChild>
                  <button type="button" className="flex items-center gap-3 w-full h-auto py-3 px-4 rounded-lg bg-muted/30 text-left">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{t('transactions.date')}</p>
                      <p className="text-sm font-medium truncate">{formattedDate}</p>
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent mode="single" selected={selectedDate} onSelect={(d) => d && setFormDate(toLocalISOString(d))} locale={getCalendarLocale()} />
                </PopoverContent>
              </Popover>

              {/* CATEGORIA (Income/Expense) */}
              {(formKind === 'EXPENSE' || formKind === 'INCOME') && (
                <Controller
                  name="category_id"
                  control={form.control}
                  render={({ field }) => (
                    <MobileSelector
                      items={categoryItems}
                      value={field.value || undefined}
                      required={true}
                      onSelect={(id) => {
                        if (id) { field.onChange(id); setFormSubcategoryId(null); }
                      }}
                      placeholder={t('transactions.selectCategory')}
                      title={t('transactions.category')}
                      icon={<Tag className="h-4 w-4" />}
                    />
                  )}
                />
              )}

              {/* CONTA DESTINO (Transfer) */}
              {formKind === 'TRANSFER' && (
                 <Controller
                   name="to_account_id"
                   control={form.control}
                   render={({ field }) => (
                     <MobileSelector
                       items={accounts.filter(a => a.id !== formAccountId).map(a => ({ id: a.id, name: a.name }))}
                       value={field.value || undefined}
                       onSelect={(id) => field.onChange(id || null)}
                       placeholder={t('transactions.selectAccount')}
                       title={t('transactions.toAccount')}
                       icon={<Wallet className="h-4 w-4" />}
                     />
                   )}
                 />
              )}

              {/* CONTA ORIGEM */}
              <Controller
                name="account_id"
                control={form.control}
                render={({ field }) => (
                  <MobileSelector
                    items={accountItems}
                    value={field.value || undefined}
                    required={true}
                    onSelect={(id) => id && field.onChange(id)}
                    placeholder={t('transactions.selectAccount')}
                    title={formKind === 'TRANSFER' ? t('transactions.fromAccount') : t('transactions.account')}
                    icon={<Wallet className="h-4 w-4" />}
                  />
                )}
              />

              {/* PAYMENT METHOD (Expense) */}
              {formKind === 'EXPENSE' && (
                <Popover open={openPayment} onOpenChange={setOpenPayment}>
                   <PopoverTrigger asChild>
                      <button type="button" onClick={() => setOpenPayment(true)} className="w-full justify-between h-auto py-3 px-4 bg-muted/30 rounded-lg flex items-center">
                         <div className="flex items-center gap-3">
                            <span className="text-muted-foreground">{getPaymentMethodIcon(formPaymentMethod)}</span>
                            <div>
                              <p className="text-xs text-muted-foreground">{t('creditCards.paymentMethod.label')}</p>
                              <p className="text-sm font-medium">{paymentMethodItems.find(p => p.id === formPaymentMethod)?.name}</p>
                            </div>
                         </div>
                         <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                   </PopoverTrigger>
                   <PopoverContent className="w-[200px] p-0">
                      <div className="p-2 grid gap-1">
                         {paymentMethodItems.map(m => (
                           <button key={m.id} type="button" className="flex w-full items-center gap-2 rounded-md p-2 text-sm hover:bg-accent" onClick={() => { setFormPaymentMethod(m.id as PaymentMethod); if(m.id !== 'credit_card') setFormCreditCardId(undefined); setOpenPayment(false); }}>
                              <span className="text-muted-foreground">{m.icon}</span> <span>{m.name}</span>
                           </button>
                         ))}
                      </div>
                   </PopoverContent>
                </Popover>
              )}

              {/* STATUS TOGGLE */}
              {formKind !== 'TRANSFER' && formPaymentMethod !== 'credit_card' && (
                <div className={`flex flex-col items-start gap-1.5 p-3 rounded-lg border ${!formIsPlanned ? 'bg-success/10 border-success/30' : 'bg-amber-500/10 border-amber-500/30'}`}>
                   <div className="flex items-center justify-between w-full">
                      <span className={`text-sm font-medium ${!formIsPlanned ? 'text-success' : 'text-amber-500'}`}>
                        {!formIsPlanned ? t('transactions.paid') : t('transactions.pending')}
                      </span>
                      <Switch checked={!formIsPlanned} onCheckedChange={(c) => setFormIsPlanned(!c)} className="data-[state=checked]:bg-success" />
                   </div>
                </div>
              )}

              {/* CREDIT CARD BADGE */}
              {formKind === 'EXPENSE' && formPaymentMethod === 'credit_card' && (
                 <div className="flex flex-col items-center justify-center p-3 rounded-lg bg-success/10 border border-success/30">
                    <span className="text-sm font-medium text-success">{t('transactions.paid')}</span>
                 </div>
              )}

              {/* RECURRENCE TOGGLE */}
              {(formKind === 'TRANSFER' || formPaymentMethod === 'credit_card') && (
                 <div className={`flex flex-col items-center justify-center p-3 rounded-lg border cursor-pointer ${formIsRecurring ? 'bg-muted/40 border-primary/30' : 'bg-muted/30 border-border'}`} onClick={() => !editingId && !formIsInstallment && setFormIsRecurring(!formIsRecurring)}>
                    <span className={`text-sm font-medium ${formIsRecurring ? 'text-primary' : 'text-foreground'}`}>{formIsRecurring ? t('common.recurrent') : t('transactions.once')}</span>
                 </div>
              )}
            </div>

            {/* FULL WIDTH RECURRENCE (Expense Non-Card) */}
            {formKind === 'EXPENSE' && formPaymentMethod !== 'credit_card' && (
               <div className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer ${formIsRecurring ? 'bg-muted/40 border-primary/30' : 'bg-muted/30 border-border'}`} onClick={() => !editingId && !formIsInstallment && setFormIsRecurring(!formIsRecurring)}>
                  <div className="flex items-center gap-2">
                     <RefreshCw className={`h-4 w-4 ${formIsRecurring ? 'text-primary' : 'text-muted-foreground'}`} />
                     <span className={`text-sm ${formIsRecurring ? 'text-primary' : 'text-muted-foreground'}`}>{t('transactions.recurrence')}</span>
                  </div>
                  <span className={`text-sm font-medium ${formIsRecurring ? 'text-primary' : 'text-foreground'}`}>{formIsRecurring ? t('common.recurrent') : t('transactions.once')}</span>
               </div>
            )}

            {/* CARTÃO DE CRÉDITO SELECT */}
            {formKind === 'EXPENSE' && formPaymentMethod === 'credit_card' && (
              <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                 <Label className="text-sm">{t('creditCards.selectCard')} <span className="text-destructive">*</span></Label>
                 <Select value={safeSelectValue(formCreditCardId)} onValueChange={(v) => setFormCreditCardId(v || undefined)}>
                    <SelectTrigger><SelectValue placeholder={t('creditCards.selectCard')} /></SelectTrigger>
                    <SelectContent>{creditCards.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                 </Select>
                 {selectedCard && formDate && (
                    <p className="text-xs text-muted-foreground flex gap-1"><CreditCard className="h-3 w-3"/> Fatura: {format(getInvoiceDueDate(calculateInvoiceMonth(new Date(formDate + 'T12:00:00'), selectedCard.closing_day), selectedCard.due_day), 'dd/MM/yyyy')}</p>
                 )}
              </div>
            )}

            {/* SUBCATEGORIA (AQUIIIII ESTAVA FALTANDO NA VERSÃO SIMPLIFICADA) */}
            {formKind === 'EXPENSE' && selectableSubcategories.length > 0 && (
               <Controller
                 name="subcategory_id"
                 control={form.control}
                 render={({ field }) => (
                   <Select value={safeSelectValue(field.value || undefined)} onValueChange={(v) => field.onChange(v || null)} disabled={!formCategoryId}>
                      <SelectTrigger><SelectValue placeholder={t('transactions.selectSubcategory')} /></SelectTrigger>
                      <SelectContent>
                         {selectableSubcategories.filter(s => s.id).map(s => (
                            <SelectItem key={s.id} value={s.id}>{s.name} {s.archived_at && <Badge variant="outline" className="text-xs">{t('categories.archived')}</Badge>}</SelectItem>
                         ))}
                      </SelectContent>
                   </Select>
                 )}
               />
            )}

            {/* RECURRING OPTIONS */}
            {formIsRecurring && !editingId && (
               <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                  <div className="grid grid-cols-2 gap-3">
                     <div><Label className="text-xs">{t('transactions.dayOfMonth')}</Label><Input type="number" min={1} max={31} value={formDayOfMonth} onChange={(e) => setFormDayOfMonth(parseInt(e.target.value)||1)} className="mt-1"/></div>
                     <div><Label className="text-xs">{t('transactions.endMonth')}</Label><Input type="month" value={formRecurringEndMonth} onChange={(e) => { setFormRecurringEndMonth(e.target.value); setFormHasEndMonth(!!e.target.value); }} className="mt-1"/></div>
                  </div>
               </div>
            )}

            {/* MORE DETAILS */}
            {formKind === 'EXPENSE' && (
               <Collapsible open={showMoreDetails} onOpenChange={setShowMoreDetails}>
                  <CollapsibleTrigger asChild><Button variant="ghost" size="sm" className="w-full justify-between text-muted-foreground"><span className="flex items-center gap-2"><Settings2 className="h-4 w-4"/> {t('transactions.moreDetails')}</span><ChevronDown className={`h-4 w-4 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`}/></Button></CollapsibleTrigger>
                  <CollapsibleContent className="space-y-3 pt-3">
                     <div className="space-y-2"><Label className="text-sm">{t('transactions.member')}</Label><Select value={safeSelectValue(formMemberId)} onValueChange={(v) => setFormMemberId(v || undefined)}><SelectTrigger><SelectValue placeholder={t('transactions.selectMember')}/></SelectTrigger><SelectContent>{members.filter(m => m.id).map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent></Select></div>
                  </CollapsibleContent>
               </Collapsible>
            )}

            {/* PARCELAMENTO (INSTALLMENTS) */}
            {isCardExpense && !editingId && (
               <InstallmentFields
                 isInstallment={formIsInstallment}
                 onIsInstallmentChange={(v) => { setFormIsInstallment(v); if(v) setFormIsRecurring(false); }}
                 installmentCount={formInstallmentCount}
                 onInstallmentCountChange={setFormInstallmentCount}
                 totalAmount={formAmount ?? 0}
                 dueDate={formInstallmentDueDate}
                 onDueDateChange={setFormInstallmentDueDate}
               />
            )}
            
            {/* ALERTAS */}
            {budgetWarning && formKind === 'EXPENSE' && (!budgetWarning.percentage || budgetWarning.percentage <= 100) && (
               <p className="text-xs text-amber-600 flex items-center gap-1"><AlertTriangle className="h-3 w-3"/> {budgetWarning.message}</p>
            )}
          </div>

          {/* FOOTER & BOTÃO RESTAURADO (AZUL) */}
          <div className="p-4 pb-6 border-t border-border/50 bg-background">
             {justSavedTransaction ? (
                <div className="flex gap-2">
                   <Button type="button" variant="outline" onClick={onClose} className="flex-1">{t('common.close')}</Button>
                   <Button type="button" variant="secondary" onClick={onCreateSimilar} className="flex-1"><Copy className="mr-2 h-4 w-4"/> {t('transactions.actions.createSimilar')}</Button>
                </div>
             ) : (
                <Button 
                  type="button" // Mantive button type=button para evitar a validação nativa chata
                  disabled={isLocalSubmitting} 
                  className="w-full h-12 text-base font-semibold" // Removido bg-green, voltou ao default (Azul/Primary)
                  onClick={handleSecureClick} // <--- AQUI É O GATILHO
                >
                  {isLocalSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                  {editingId ? t('common.save') : t('transactions.saveTransaction')}
                </Button>
             )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}