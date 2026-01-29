import { FormEvent, useEffect, useState, useRef, KeyboardEvent } from 'react';
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
import { useLastCategoryTransaction } from '@/hooks/useLastCategoryTransaction';
import { useIsMobile } from '@/hooks/use-mobile';
import { format } from 'date-fns';
import { ptBR, enUS, es } from 'date-fns/locale';
import { toLocalISOString } from '@/lib/dateOnly';
import { supabase } from '@/integrations/supabase/client';

interface Account {
  id: string;
  name: string;
  type?: string;
}

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  archived_at?: string | null;
}

interface Subcategory {
  id: string;
  name: string;
  archived_at?: string | null;
}

interface Member {
  id: string;
  name: string;
}

interface CreditCard {
  id: string;
  name: string;
  color: string;
  closing_day: number;
  due_day: number;
}

interface BudgetWarning {
  message: string;
  type: string;
  percentage?: number;
}

interface CategorySuggestion {
  categoryId: string;
  categoryName: string;
  subcategoryId?: string;
  subcategoryName?: string;
}

interface TransactionFormDialogProps {
  // Dialog state
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingId: string | null;

  // Form fields
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

  // Status and type
  formIsPlanned: boolean;
  setFormIsPlanned: (planned: boolean) => void;
  isEditingConfirmed: boolean;
  isEditingPastMonth: boolean;
  isFieldsLocked: boolean;

  // Installments
  formIsInstallment: boolean;
  setFormIsInstallment: (isInstallment: boolean) => void;
  formInstallmentCount: number;
  setFormInstallmentCount: (count: number) => void;
  formInstallmentDueDate: string;
  setFormInstallmentDueDate: (date: string) => void;

  // Recurring
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

  // Payment method
  formPaymentMethod: PaymentMethod;
  setFormPaymentMethod: (method: PaymentMethod) => void;
  formCreditCardId: string | undefined;
  setFormCreditCardId: (id: string | undefined) => void;

  // Data
  accounts: Account[];
  selectableCategories: Category[];
  selectableSubcategories: Subcategory[];
  members: Member[];
  creditCards: CreditCard[];

  // Validation
  budgetWarning: BudgetWarning | null;
  descriptionSuggestions: string[];
  categorySuggestion: CategorySuggestion | null;
  showCategorySuggestion: boolean;

  // Refs
  amountInputRef: React.RefObject<HTMLInputElement>;

  // Post-save state
  justSavedTransaction: any;
  onCreateSimilar: () => void;
  onClose: () => void;

  // Submit
  onSubmit: (e: FormEvent) => void;
  isMutationPending: boolean;
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  editingId,
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
  onSubmit,
  isMutationPending,
}: TransactionFormDialogProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [openPayment, setOpenPayment] = useState(false);
  const [showMoreDetails, setShowMoreDetails] = useState(false);
  
  // Manual selection flags - prevent smart defaults from overwriting user choices
  const userChangedPaymentMethod = useRef(false);
  const userChangedAccount = useRef(false);
  const userChangedCategory = useRef(false);

  // Reset manual flags when modal opens for new transaction
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
    
    // INCOME: Always confirmed/received immediately (MVP decision)
    if (formKind === 'INCOME') {
      setFormIsPlanned(false);
      return;
    }
    
    // Credit card payments are always "paid" (liability is immediate)
    if (formKind === 'EXPENSE' && formPaymentMethod === 'credit_card') {
      setFormIsPlanned(false);
      return;
    }
    
    // Auto-toggle: future dates = planned (not paid), today/past = confirmed (paid)
    if (isFutureDate) {
      setFormIsPlanned(true);
    } else {
      setFormIsPlanned(false);
    }
  }, [formDate, formPaymentMethod, formKind, setFormIsPlanned]);
  const descriptionInputRef = useRef<HTMLInputElement>(null);

  // Smart defaults: fetch last transaction for selected category
  const { defaults: categoryDefaults } = useLastCategoryTransaction(
    formKind === 'EXPENSE' ? formCategoryId : undefined
  );

  // Apply smart defaults when category changes (for new transactions only)
  // Level 1: Use prediction/history defaults
  // Level 2: Fallback to 'debit' if no history exists
  useEffect(() => {
    if (!editingId && formKind === 'EXPENSE') {
      if (categoryDefaults) {
        // Level 1: Apply account from history - ONLY if user hasn't manually changed it
        if (!formAccountId && categoryDefaults.accountId && !userChangedAccount.current) {
          const validAccount = accounts.some(a => a.id === categoryDefaults.accountId);
          if (validAccount) {
            setFormAccountId(categoryDefaults.accountId);
          }
        }
        // Only apply payment method defaults if user hasn't manually changed it
        if (categoryDefaults.paymentMethod && !userChangedPaymentMethod.current) {
          setFormPaymentMethod(categoryDefaults.paymentMethod);
          if (categoryDefaults.paymentMethod === 'credit_card' && categoryDefaults.creditCardId) {
            const validCard = creditCards.some(c => c.id === categoryDefaults.creditCardId);
            if (validCard) {
              setFormCreditCardId(categoryDefaults.creditCardId);
            }
          }
        }
      } else if (formCategoryId && !formPaymentMethod && !userChangedPaymentMethod.current) {
        // Level 2: Fallback - new category with no history, default to 'debit'
        setFormPaymentMethod('debit');
      }
    }
  }, [categoryDefaults, editingId, formKind, formAccountId, formCategoryId, formPaymentMethod, accounts, creditCards, setFormAccountId, setFormPaymentMethod, setFormCreditCardId]);

  // Check if current account is a credit card type
  const selectedAccount = accounts.find(a => a.id === formAccountId);
  const isCardExpense = formKind === 'EXPENSE' && selectedAccount?.type === 'CARD';
  const selectedCategory = selectableCategories.find(c => c.id === formCategoryId);
  const selectedCard = creditCards.find(c => c.id === formCreditCardId);

  const handleOpenChange = (openState: boolean) => {
    if (!openState) {
      onClose();
    }
    onOpenChange(openState);
  };

  // UX #1: Handle Enter key on amount field to jump to description
  const handleAmountKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      descriptionInputRef.current?.focus();
    }
  };

  // UX #2: Handle prediction selection from smart description input
  const handlePredictionSelect = (prediction: {
    categoryId: string | null;
    subcategoryId: string | null;
    accountId: string | null;
    paymentMethod: PaymentMethod | null;
    description: string | null;
  }) => {
    if (prediction.categoryId) {
      const validCategory = selectableCategories.some(c => c.id === prediction.categoryId);
      if (validCategory) {
        setFormCategoryId(prediction.categoryId);
      }
    }
    if (prediction.subcategoryId) {
      setFormSubcategoryId(prediction.subcategoryId);
    }
    if (prediction.accountId) {
      const validAccount = accounts.some(a => a.id === prediction.accountId);
      if (validAccount) {
        setFormAccountId(prediction.accountId);
      }
    }
    if (prediction.paymentMethod) {
      setFormPaymentMethod(prediction.paymentMethod);
    }
  };

  // UX #3: Handle quick chip selection - trigger prediction and focus amount
  const handleQuickChipSelect = async (description: string) => {
    // Trigger prediction via RPC
    if (description.length >= 2) {
      try {
        const { data, error } = await supabase.rpc('predict_transaction_details', {
          p_description: description,
        });
        
        if (!error && data) {
          const prediction = data as {
            category_id: string | null;
            subcategory_id: string | null;
            account_id: string | null;
            payment_method: string | null;
          };
          
          handlePredictionSelect({
            categoryId: prediction.category_id,
            subcategoryId: prediction.subcategory_id,
            accountId: prediction.account_id,
            paymentMethod: prediction.payment_method as PaymentMethod | null,
            description: null,
          });
        }
      } catch (err) {
        console.error('Quick chip prediction error:', err);
      }
    }
    
    // Focus amount field after a short delay to ensure state updates
    setTimeout(() => {
      amountInputRef.current?.focus();
    }, 50);
  };
  // Format date for display
  const formattedDate = formDate 
    ? format(new Date(formDate + 'T12:00:00'), 'dd/MM/yyyy')
    : t('transactions.today');
  
  // Get locale for calendar
  const getCalendarLocale = () => {
    const lang = t('common.languageCode') || 'pt-BR';
    if (lang.startsWith('es')) return es;
    if (lang.startsWith('en')) return enUS;
    return ptBR;
  };
  
  // Parse formDate string to Date object for Calendar
  const selectedDate = formDate 
    ? new Date(formDate + 'T12:00:00') 
    : new Date();

  const getKindTitle = () => {
    switch (formKind) {
      case 'EXPENSE': return t('transactions.kind.expense');
      case 'INCOME': return t('transactions.kind.income');
      case 'TRANSFER': return t('transactions.kind.transfer');
    }
  };

  // Payment method icon helper
  const getPaymentMethodIcon = (method: PaymentMethod) => {
    switch (method) {
      case 'credit_card': return <CreditCard className="h-4 w-4" />;
      case 'pix': return <span className="text-sm">💠</span>;
      case 'cash': return <span className="text-sm">💵</span>;
      case 'boleto': return <span className="text-sm">📄</span>;
      default: return <Wallet className="h-4 w-4" />;
    }
  };

  // Prepare items for mobile selectors
  const categoryItems = selectableCategories.filter(c => c.id).map(c => ({
    id: c.id,
    name: c.name,
    badge: c.archived_at ? t('categories.archived') : undefined,
  }));

  const paymentMethodItems = [
    { id: 'debit', name: t('creditCards.paymentMethod.debit'), icon: <Wallet className="h-4 w-4" /> },
    { id: 'credit_card', name: t('creditCards.paymentMethod.credit_card'), icon: <CreditCard className="h-4 w-4" /> },
    { id: 'pix', name: t('creditCards.paymentMethod.pix'), icon: <span className="text-sm">💠</span> },
    { id: 'cash', name: t('creditCards.paymentMethod.cash'), icon: <span className="text-sm">💵</span> },
    { id: 'boleto', name: t('creditCards.paymentMethod.boleto'), icon: <span className="text-sm">📄</span> },
  ];

  const accountItems = accounts.filter(a => a.id).map(a => ({
    id: a.id,
    name: a.name,
  }));

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md p-0 gap-0 overflow-hidden" data-testid="transaction-form-dialog">
        {/* Clean Header - Vertical Stack Layout */}
        <DialogHeader className="p-4 pb-3 flex-shrink-0 space-y-0">
          {/* Line 1: Title only (Close button is auto-positioned by DialogContent) */}
          <DialogTitle className="text-lg font-semibold pr-8">
            {editingId ? t('transactions.edit') : getKindTitle()}
          </DialogTitle>
          
          {/* Editing warnings */}
          {isEditingPastMonth && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
              <CalendarIcon className="h-3 w-3" />
              {t('transactions.warnings.pastMonthShort')}
            </p>
          )}
          {isEditingConfirmed && !isEditingPastMonth && (
            <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
              <AlertCircle className="h-3 w-3" />
              {t('transactions.warnings.confirmedShort')}
            </p>
          )}
          
          {/* Line 2: Transaction Type Tabs - separated from close button */}
          {!editingId && (
            <div className="pt-3">
              <Tabs 
                value={formKind} 
                onValueChange={(v) => {
                  const newKind = v as TransactionKind;
                  setFormKind(newKind);
                  if (newKind !== 'EXPENSE') {
                    setFormCategoryId(undefined);
                    setFormSubcategoryId(undefined);
                  }
                }}
                className="w-full"
              >
                <TabsList className="w-full h-9 p-1">
                  <TabsTrigger value="EXPENSE" className="flex-1 text-sm h-7" data-testid="tab-expense">
                    {t('transactions.kind.expenseShort')}
                  </TabsTrigger>
                  <TabsTrigger value="INCOME" className="flex-1 text-sm h-7" data-testid="tab-income">
                    {t('transactions.kind.incomeShort')}
                  </TabsTrigger>
                  <TabsTrigger value="TRANSFER" className="flex-1 text-sm h-7" data-testid="tab-transfer">
                    {t('transactions.kind.transferShort')}
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          )}
        </DialogHeader>

        <form onSubmit={onSubmit} className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-4">
            
            {/* HERO: Amount Input with Enter key handler - NEVER disabled for editing */}
            <div className="py-6 border-b border-border/50" data-testid="hero-section">
              <HeroAmountInput
                ref={amountInputRef}
                value={formAmount}
                onChange={setFormAmount}
                disabled={false}
                autoFocus={!editingId}
                onKeyDown={handleAmountKeyDown}
                data-testid="form-amount"
              />
            </div>

            {/* Smart Description Input with Autocomplete - NEVER disabled */}
            <div className="space-y-3">
              <SmartDescriptionInput
                value={formDescription}
                onChange={setFormDescription}
                onPredictionSelect={handlePredictionSelect}
                memberId={formMemberId}
                accountId={formAccountId}
                categoryId={formCategoryId}
                disabled={false}
                inputRef={descriptionInputRef}
              />
              
              {/* Quick Chips - One-Tap Logic */}
              <QuickChips 
                onSelect={setFormDescription}
                onSelectComplete={handleQuickChipSelect}
                currentValue={formDescription}
              />
            </div>

            {/* Mobile-First Selectors Grid */}
            <div className="grid grid-cols-2 gap-2" data-testid="details-grid">
              {/* Date Selector - FIX #1: Full Calendar with NO min/max constraints */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="flex items-center gap-3 w-full h-auto py-3 px-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors cursor-pointer text-left"
                    data-testid="form-date"
                  >
                    <CalendarIcon className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="text-left flex-1 min-w-0">
                      <p className="text-xs text-muted-foreground">{t('transactions.date')}</p>
                      <p className="text-sm font-medium truncate">{formattedDate}</p>
                    </div>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <CalendarComponent
                    mode="single"
                    selected={selectedDate}
                    onSelect={(date) => {
                      if (date) {
                        setFormDate(toLocalISOString(date));
                      }
                    }}
                    locale={getCalendarLocale()}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>

              {/* Category Selector (Expense only) - Mobile-First */}
              {formKind === 'EXPENSE' ? (
                <MobileSelector
                  items={categoryItems}
                  value={formCategoryId}
                  onSelect={(id) => {
                    userChangedCategory.current = true;
                    setFormCategoryId(id);
                    setFormSubcategoryId(undefined);
                  }}
                  placeholder={t('transactions.selectCategory')}
                  title={t('transactions.category')}
                  icon={<Tag className="h-4 w-4" />}
                  disabled={false}
                  data-testid="slot-category"
                />
              ) : formKind === 'TRANSFER' ? (
                /* Transfer: Show To Account selector directly in grid (no duplicate below) */
                <MobileSelector
                  items={accounts.filter(a => a.id && a.id !== formAccountId).map(a => ({ id: a.id, name: a.name }))}
                  value={formToAccountId}
                  onSelect={setFormToAccountId}
                  placeholder={t('transactions.selectAccount')}
                  title={t('transactions.toAccount')}
                  icon={<Wallet className="h-4 w-4" />}
                  disabled={false}
                  data-testid="form-to-account-grid"
                />
              ) : (
                /* Income: Category not needed */
                <div className="flex flex-col items-start gap-1 p-3 rounded-lg bg-muted/30">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Tag className="h-4 w-4" />
                    <span className="text-xs">{t('transactions.category')}</span>
                  </div>
                  <span className="text-sm font-medium text-muted-foreground">-</span>
                </div>
              )}

              {/* Account Selector - Mobile-First */}
              <MobileSelector
                items={accountItems}
                value={formAccountId}
                onSelect={(id) => {
                  userChangedAccount.current = true;
                  setFormAccountId(id);
                }}
                placeholder={t('transactions.selectAccount')}
                title={formKind === 'TRANSFER' ? t('transactions.fromAccount') : t('transactions.account')}
                icon={<Wallet className="h-4 w-4" />}
                disabled={false}
                data-testid="slot-account"
              />

              {/* Payment Method Chip - Visible in Grid for Expenses */}
              {formKind === 'EXPENSE' && (
                <>
                  {(() => {
                    const selected = paymentMethodItems.find((m) => m.id === formPaymentMethod);
                    const trigger = (
                      <button
                        type="button"
                        role="combobox"
                        aria-expanded={openPayment}
                        className={cn(
                          'w-full justify-between h-auto py-3 px-4',
                          'bg-muted/30 hover:bg-muted/50 border-0',
                          'rounded-lg transition-colors',
                          'flex items-center'
                        )}
                        onClick={() => setOpenPayment(true)}
                        data-testid="slot-payment-method"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-muted-foreground">{getPaymentMethodIcon(formPaymentMethod)}</span>
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">{t('creditCards.paymentMethod.label')}</p>
                            <p className={cn('text-sm font-medium', !selected && 'text-muted-foreground')}>
                              {selected?.name || t('creditCards.paymentMethod.debit')}
                            </p>
                          </div>
                        </div>
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </button>
                    );

                    const list = (
                      <div className="p-2 grid gap-1" data-testid="payment-method-list">
                        {paymentMethodItems.map((method) => (
                          <button
                            key={method.id}
                            type="button"
                            className={cn(
                              'flex w-full items-center gap-2 rounded-md p-2 text-sm text-left transition-colors',
                              'hover:bg-accent hover:text-accent-foreground',
                              formPaymentMethod === method.id && 'bg-accent'
                            )}
                            onClick={() => {
                              userChangedPaymentMethod.current = true; // Mark as manual selection
                              const next = method.id as PaymentMethod;
                              setFormPaymentMethod(next);
                              if (next !== 'credit_card') {
                                setFormCreditCardId(undefined);
                              }
                              setOpenPayment(false);
                            }}
                            data-testid={`payment-method-option-${method.id}`}
                          >
                            <span className="text-muted-foreground">{method.icon}</span>
                            <span>{method.name}</span>
                          </button>
                        ))}
                      </div>
                    );

                    if (isMobile) {
                      return (
                        <Drawer open={openPayment} onOpenChange={setOpenPayment}>
                          {trigger}
                          <DrawerContent className="bg-background">
                            <DrawerHeader className="text-left">
                              <DrawerTitle>{t('creditCards.paymentMethod.label')}</DrawerTitle>
                            </DrawerHeader>
                            <div className="px-4 pb-4">{list}</div>
                          </DrawerContent>
                        </Drawer>
                      );
                    }

                    return (
                      <Popover open={openPayment} onOpenChange={setOpenPayment}>
                        <PopoverTrigger asChild>{trigger}</PopoverTrigger>
                        <PopoverContent
                          className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border shadow-lg z-50"
                          align="start"
                        >
                          {list}
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </>
              )}

              {/* FEATURE: "Paid?" Switch - Smart Status with manual override */}
              {formKind !== 'TRANSFER' && formPaymentMethod !== 'credit_card' && (
                <div 
                  className={`flex flex-col items-start gap-1.5 p-3 rounded-lg transition-colors ${
                    !formIsPlanned 
                      ? 'bg-success/10 border border-success/30' 
                      : 'bg-amber-500/10 border border-amber-500/30'
                  }`}
                  data-testid="slot-status-toggle"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Wallet className={`h-4 w-4 ${!formIsPlanned ? 'text-success' : 'text-amber-500'}`} />
                    <span className="text-xs">{t('transactions.paidQuestion')}</span>
                  </div>
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-sm font-medium ${!formIsPlanned ? 'text-success' : 'text-amber-500'}`}>
                      {!formIsPlanned ? t('transactions.paid') : t('transactions.pending')}
                    </span>
                    <Switch
                      checked={!formIsPlanned}
                      onCheckedChange={(checked) => setFormIsPlanned(!checked)}
                      className="data-[state=checked]:bg-success"
                      data-testid="switch-paid"
                    />
                  </div>
                </div>
              )}

              {/* Credit Card: Always Paid Badge (non-interactive) */}
              {formKind === 'EXPENSE' && formPaymentMethod === 'credit_card' && (
                <div 
                  className="flex flex-col items-start gap-1 p-3 rounded-lg bg-success/10 border border-success/30"
                  data-testid="slot-status-credit-card"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <CreditCard className="h-4 w-4 text-success" />
                    <span className="text-xs">{t('transactions.statusToggle')}</span>
                  </div>
                  <span className="text-sm font-medium text-success">
                    {t('transactions.paid')}
                  </span>
                </div>
              )}

              {/* Recurrence Toggle - Only show for transfers or credit card expenses */}
              {(formKind === 'TRANSFER' || formPaymentMethod === 'credit_card') && (
                <div 
                  className={`flex flex-col items-start gap-1 p-3 rounded-lg transition-colors cursor-pointer border ${
                    formIsRecurring ? 'border-primary/30 bg-muted/40' : 'border-border bg-muted/30 hover:bg-muted/50'
                  } ${(!!editingId || formIsInstallment) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  onClick={() => !editingId && !formIsInstallment && setFormIsRecurring(!formIsRecurring)}
                  data-testid="slot-recurrence"
                >
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <RefreshCw className={`h-4 w-4 ${formIsRecurring ? 'text-primary' : ''}`} />
                    <span className="text-xs">{t('transactions.recurrence')}</span>
                  </div>
                  <span className={`text-sm font-medium ${formIsRecurring ? 'text-primary' : 'text-foreground'}`}>
                    {formIsRecurring ? t('common.recurrent') : t('transactions.once')}
                  </span>
                </div>
              )}
            </div>

            {/* Recurrence Toggle (full width) for EXPENSE when status toggle is shown */}
            {formKind === 'EXPENSE' && formPaymentMethod !== 'credit_card' && (
              <div 
                className={`flex items-center justify-between p-3 rounded-lg transition-colors cursor-pointer border ${
                  formIsRecurring ? 'border-primary/30 bg-muted/40' : 'border-border bg-muted/30 hover:bg-muted/50'
                } ${(!!editingId || formIsInstallment) ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !editingId && !formIsInstallment && setFormIsRecurring(!formIsRecurring)}
                data-testid="slot-recurrence-expense"
              >
                <div className="flex items-center gap-2">
                  <RefreshCw className={`h-4 w-4 ${formIsRecurring ? 'text-primary' : 'text-muted-foreground'}`} />
                  <span className={`text-sm ${formIsRecurring ? 'text-primary font-medium' : 'text-muted-foreground'}`}>
                    {t('transactions.recurrence')}
                  </span>
                </div>
                <span className={`text-sm font-medium ${formIsRecurring ? 'text-primary' : 'text-foreground'}`}>
                  {formIsRecurring ? t('common.recurrent') : t('transactions.once')}
                </span>
              </div>
            )}

            {/* UX #5: Real-time Budget Feedback */}
            {formKind === 'EXPENSE' && budgetWarning && budgetWarning.percentage && budgetWarning.percentage > 100 && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1 px-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {t('transactions.budgetOverflow', { percentage: budgetWarning.percentage })}
              </p>
            )}

            {/* Credit Card Selector - Shown immediately when credit_card is selected */}
            {formKind === 'EXPENSE' && formPaymentMethod === 'credit_card' && (
              <div className="space-y-2 p-3 rounded-lg border border-border/50 bg-muted/20">
                <Label className="text-sm flex items-center gap-1">
                  <CreditCard className="h-4 w-4 text-muted-foreground mr-1" />
                  {t('creditCards.selectCard')}
                  <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={safeSelectValue(formCreditCardId)}
                  onValueChange={(v) => setFormCreditCardId(v || undefined)}
                  disabled={false}
                >
                  <SelectTrigger className={!formCreditCardId ? 'border-destructive/50' : ''}>
                    <SelectValue placeholder={t('creditCards.selectCard')} />
                  </SelectTrigger>
                  <SelectContent className="bg-popover border shadow-lg z-50">
                    {creditCards.map(card => (
                      <SelectItem key={card.id} value={card.id}>
                        <span className="flex items-center gap-2">
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: card.color }}
                          />
                          {card.name}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCard && formDate && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {(() => {
                      const invoiceMonth = calculateInvoiceMonth(new Date(formDate + 'T12:00:00'), selectedCard.closing_day);
                      const dueDate = getInvoiceDueDate(invoiceMonth, selectedCard.due_day);
                      const formattedDueDate = format(dueDate, 'dd/MM/yyyy');
                      return t('creditCards.invoiceInfoWithDate', { dueDate: formattedDueDate });
                    })()}
                  </p>
                )}
              </div>
            )}

            {/* Boleto: due_date is now auto-calculated from formDate (Single Date Source) */}

            {/* Transfer: To Account is now in the main grid above - removed duplicate */}

            {/* Expense: Subcategory (if available) */}
            {formKind === 'EXPENSE' && selectableSubcategories.length > 0 && (
              <Select
                value={safeSelectValue(formSubcategoryId)}
                onValueChange={(v) => setFormSubcategoryId(v || undefined)}
                disabled={!formCategoryId}
              >
                <SelectTrigger 
                  className={!formSubcategoryId ? 'border-destructive/50' : ''}
                  data-testid="form-subcategory-select"
                >
                  <SelectValue placeholder={t('transactions.selectSubcategory')} />
                </SelectTrigger>
                <SelectContent className="bg-popover border shadow-lg z-50">
                  {selectableSubcategories.filter(s => s.id).map(s => (
                    <SelectItem key={s.id} value={s.id}>
                      <span className="flex items-center gap-2">
                        {s.name}
                        {s.archived_at && (
                          <Badge variant="outline" className="text-xs py-0 px-1">
                            {t('categories.archived')}
                          </Badge>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {/* Recurring Options (when enabled) */}
            {formIsRecurring && !editingId && (
              <div className="space-y-3 p-3 rounded-lg bg-muted/20 border border-border/50">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium">{t('transactions.recurringOptions')}</Label>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('transactions.dayOfMonth')}</Label>
                    <Input
                      type="number"
                      min={1}
                      max={31}
                      value={formDayOfMonth}
                      onChange={(e) => setFormDayOfMonth(parseInt(e.target.value) || 1)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">{t('transactions.endMonth')}</Label>
                    <Input
                      type="month"
                      value={formRecurringEndMonth}
                      onChange={(e) => {
                        setFormRecurringEndMonth(e.target.value);
                        setFormHasEndMonth(!!e.target.value);
                      }}
                      placeholder={t('transactions.optional')}
                      className="mt-1"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* UX #4: More Details Collapsible */}
            {formKind === 'EXPENSE' && (
              <Collapsible open={showMoreDetails} onOpenChange={setShowMoreDetails}>
                <CollapsibleTrigger asChild>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm" 
                    className="w-full justify-between text-muted-foreground"
                  >
                    <span className="flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      {t('transactions.moreDetails')}
                    </span>
                    <ChevronDown className={`h-4 w-4 transition-transform ${showMoreDetails ? 'rotate-180' : ''}`} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 pt-3">
                  {/* Member */}
                  <div className="space-y-2">
                    <Label className="text-sm">{t('transactions.member')}</Label>
                    <Select value={safeSelectValue(formMemberId)} onValueChange={(v) => setFormMemberId(v || undefined)}>
                      <SelectTrigger data-testid="form-member-select">
                        <SelectValue placeholder={t('transactions.selectMember')} />
                      </SelectTrigger>
                      <SelectContent className="bg-popover border shadow-lg z-50">
                        {members.filter(m => m.id).map(m => (
                          <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* Income is always treated as confirmed/received - no toggle needed */}

            {/* Installment fields */}
            {isCardExpense && !editingId && (
              <InstallmentFields
                isInstallment={formIsInstallment}
                onIsInstallmentChange={(v) => {
                  setFormIsInstallment(v);
                  if (v) setFormIsRecurring(false);
                }}
                installmentCount={formInstallmentCount}
                onInstallmentCountChange={setFormInstallmentCount}
                totalAmount={formAmount ?? 0}
                dueDate={formInstallmentDueDate}
                onDueDateChange={setFormInstallmentDueDate}
              />
            )}
          </div>

          {/* Footer */}
          <div className="p-4 pb-6 md:pb-4 border-t border-border/50 space-y-3 bg-background">
            {/* Budget Warning - discrete (for non-overflow warnings) */}
            {budgetWarning && formKind === 'EXPENSE' && (!budgetWarning.percentage || budgetWarning.percentage <= 100) && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3 flex-shrink-0" />
                {budgetWarning.message}
              </p>
            )}

            {/* Action Buttons */}
            {justSavedTransaction ? (
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={onClose} className="flex-1" data-testid="btn-close-dialog">
                  {t('common.close')}
                </Button>
                <Button type="button" variant="secondary" onClick={onCreateSimilar} className="flex-1" data-testid="btn-create-similar">
                  <Copy className="mr-2 h-4 w-4" />
                  {t('transactions.actions.createSimilar')}
                </Button>
              </div>
            ) : (
              <Button 
                type="submit" 
                disabled={isMutationPending} 
                className="w-full h-12 text-base font-semibold"
                data-testid="btn-submit-form"
              >
                {isMutationPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {editingId ? t('common.save') : t('transactions.saveTransaction')}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
