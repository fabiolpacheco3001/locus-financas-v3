import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TrendingUp, TrendingDown, Minus, Building2, ChevronDown, ChevronUp, Calendar, Calculator, X, RotateCcw, Lightbulb, ExternalLink, Info, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { MoneyInput } from '@/components/ui/money-input';
import { AccountProjection, PendingTransactionDetail } from '@/hooks/useAccountProjections';
import { useLocale } from '@/i18n/useLocale';

interface ProjectionDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projections: AccountProjection[];
  totals: {
    realizedBalance: number;
    projectedBalance: number;
    pendingIncome: number;
    pendingExpenses: number;
  };
  projectionDateLabel: string;
}

interface SimulationState {
  accountId: string | null;
  type: 'expense' | 'income';
  amount: number | undefined;
}

type FilterMode = 'relevant' | 'all';

function getTrendColor(current: number, projected: number): string {
  const diff = projected - current;
  
  if (Math.abs(diff) < 0.01) {
    return 'text-muted-foreground';
  }
  
  if (projected < 0) {
    return 'text-destructive';
  }
  
  if (diff > 0) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  
  return 'text-amber-500 dark:text-amber-400';
}

function getDeltaColor(delta: number, projected: number): string {
  if (Math.abs(delta) < 0.01) {
    return 'text-muted-foreground';
  }
  if (projected < 0) {
    return 'text-destructive';
  }
  if (delta > 0) {
    return 'text-emerald-600 dark:text-emerald-400';
  }
  return 'text-amber-500 dark:text-amber-400';
}

function TrendIndicator({ current, projected }: { current: number; projected: number }) {
  const diff = projected - current;
  const colorClass = getTrendColor(current, projected);
  
  if (Math.abs(diff) < 0.01) {
    return <Minus className={`h-4 w-4 ${colorClass}`} />;
  }
  if (diff > 0) {
    return <TrendingUp className={`h-4 w-4 ${colorClass}`} />;
  }
  return <TrendingDown className={`h-4 w-4 ${colorClass}`} />;
}

const MAX_ITEMS_SHOWN = 5;

function TransactionList({ 
  transactions, 
  type 
}: { 
  transactions: PendingTransactionDetail[]; 
  type: 'income' | 'expense';
}) {
  const { t, formatCurrency, formatDateShort } = useLocale();
  const visibleItems = transactions.slice(0, MAX_ITEMS_SHOWN);
  const hiddenItems = transactions.slice(MAX_ITEMS_SHOWN);
  const hiddenTotal = hiddenItems.reduce((sum, tx) => sum + tx.amount, 0);

  if (transactions.length === 0) return null;

  const isIncome = type === 'income';
  const headerColor = isIncome 
    ? 'text-emerald-600 dark:text-emerald-400' 
    : 'text-destructive';
  const headerLabel = isIncome ? t('projection.futureIncome') : t('projection.billsToPay');
  const totalAmount = transactions.reduce((sum, tx) => sum + tx.amount, 0);

  return (
    <div className="mt-3 space-y-2 w-full min-w-0 overflow-hidden">
      <div className={`flex items-center justify-between gap-2 text-sm font-medium ${headerColor} w-full min-w-0`}>
        <span className="min-w-0 truncate">{headerLabel}</span>
        <span className="flex-shrink-0">{formatCurrency(totalAmount)}</span>
      </div>
      <div className="space-y-1.5 pl-2 border-l-2 border-border w-full min-w-0 overflow-hidden">
        {visibleItems.map((tx) => (
          <div 
            key={tx.id} 
            className="flex items-start justify-between gap-2 text-xs py-1 w-full min-w-0 overflow-hidden"
          >
            <div className="flex-1 min-w-0 overflow-hidden">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{formatDateShort(tx.date)}</span>
              </div>
              <p className="font-medium truncate mt-0.5">
                {tx.description || t('projection.noDescription')}
              </p>
              {(tx.categoryName || tx.subcategoryName) && (
                <p className="text-muted-foreground truncate">
                  {tx.categoryName}
                  {tx.subcategoryName && ` / ${tx.subcategoryName}`}
                </p>
              )}
            </div>
            <span className={`font-medium flex-shrink-0 ${isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
              {formatCurrency(tx.amount)}
            </span>
          </div>
        ))}
        {hiddenItems.length > 0 && (
          <div className="flex items-center justify-between gap-2 text-xs py-1 text-muted-foreground italic w-full min-w-0">
            <span className="min-w-0 truncate">{t('projection.otherItems', { count: hiddenItems.length })}</span>
            <span className="flex-shrink-0">{formatCurrency(hiddenTotal)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function SmartRecommendations({ 
  projection,
  onNavigate
}: { 
  projection: AccountProjection;
  onNavigate: (transactionId: string) => void;
}) {
  const { t, formatCurrency, formatDateShort } = useLocale();
  
  if (projection.projectedBalance >= 0) return null;

  const MAX_SUGGESTIONS_PER_TYPE = 2;
  const MAX_TOTAL_SUGGESTIONS = 4;

  const incomeSuggestions = projection.plannedIncomes.slice(0, MAX_SUGGESTIONS_PER_TYPE);
  const expenseSuggestions = projection.plannedExpenses.slice(0, MAX_SUGGESTIONS_PER_TYPE);

  const totalSuggestions = incomeSuggestions.length + expenseSuggestions.length;
  let finalIncomeSuggestions = incomeSuggestions;
  let finalExpenseSuggestions = expenseSuggestions;
  
  if (totalSuggestions > MAX_TOTAL_SUGGESTIONS) {
    const excessCount = totalSuggestions - MAX_TOTAL_SUGGESTIONS;
    finalExpenseSuggestions = expenseSuggestions.slice(0, Math.max(0, expenseSuggestions.length - excessCount));
  }

  const hasSuggestions = finalIncomeSuggestions.length > 0 || finalExpenseSuggestions.length > 0;

  if (!hasSuggestions) return null;

  return (
    <div className="px-4 pb-3 w-full min-w-0 overflow-hidden box-border">
      <Accordion type="single" collapsible className="w-full min-w-0">
        <AccordionItem value="recommendations" className="border-0 w-full min-w-0">
          <AccordionTrigger className="py-2 px-3 rounded-lg bg-muted/50 hover:bg-muted/70 hover:no-underline [&[data-state=open]]:rounded-b-none w-full min-w-0">
            <div className="flex items-center gap-2 min-w-0">
              <Info className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium text-foreground truncate">{t('projection.understandVariation')}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="px-3 pb-3 pt-2 bg-muted/30 rounded-b-lg w-full min-w-0 overflow-hidden">
            <div className="flex items-center gap-1.5 mb-3 min-w-0">
              <Lightbulb className="h-3.5 w-3.5 text-muted-foreground flex-shrink-0" />
              <p className="text-xs text-muted-foreground truncate">
                {t('projection.suggestionsNoAutoAction')}
              </p>
            </div>

            <div className="space-y-2 max-h-[200px] overflow-y-auto overflow-x-hidden w-full min-w-0">
              {finalIncomeSuggestions.map((income) => (
                <div 
                  key={income.id}
                  className="p-3 rounded-md bg-background border border-border w-full min-w-0 overflow-hidden box-border"
                >
                  <p className="text-xs text-muted-foreground mb-1">{t('projection.confirmIncome')}</p>
                  <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400 mb-1">
                    {formatCurrency(income.amount)}
                  </p>
                  <p className="text-sm text-foreground break-words mb-2 min-w-0">
                    {income.description || income.categoryName || t('transactions.kind.income')}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs w-full min-w-0"
                    onClick={() => onNavigate(income.id)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{t('common.viewTransaction')}</span>
                  </Button>
                </div>
              ))}

              {finalExpenseSuggestions.map((expense) => (
                <div 
                  key={expense.id}
                  className="p-3 rounded-md bg-background border border-border w-full min-w-0 overflow-hidden box-border"
                >
                  <p className="text-xs text-muted-foreground mb-1">{t('projection.evaluatePostponement')}</p>
                  <p className="text-sm font-semibold text-foreground mb-1">
                    {formatCurrency(expense.amount)}
                  </p>
                  <p className="text-sm text-foreground break-words mb-1 min-w-0">
                    {expense.description || expense.categoryName || t('transactions.kind.expense')}
                  </p>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t('projection.dueOn', { date: formatDateShort(expense.date) })}
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs w-full min-w-0"
                    onClick={() => onNavigate(expense.id)}
                  >
                    <ExternalLink className="h-3 w-3 mr-1.5 flex-shrink-0" />
                    <span className="truncate">{t('common.viewTransaction')}</span>
                  </Button>
                </div>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

function QuickSimulator({
  projection, 
  simulation,
  onSimulationChange,
  onClear
}: { 
  projection: AccountProjection;
  simulation: SimulationState | null;
  onSimulationChange: (sim: SimulationState) => void;
  onClear: () => void;
}) {
  const { t, formatCurrency } = useLocale();
  const isActive = simulation?.accountId === projection.account.id;
  const amount = isActive ? (simulation?.amount ?? 0) : 0;
  const type = isActive ? simulation?.type ?? 'expense' : 'expense';
  
  const impact = type === 'income' ? amount : -amount;
  const simulatedProjected = projection.projectedBalance + impact;
  
  const hasSimulation = isActive && amount > 0;

  return (
    <div className="border-t border-border pt-3 px-4 pb-4">
      <div className="flex items-center gap-2 mb-3">
        <Calculator className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-medium">{t('projection.quickSimulator')}</span>
        {hasSimulation && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 ml-auto text-xs text-muted-foreground hover:text-foreground"
            onClick={onClear}
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            {t('projection.clear')}
          </Button>
        )}
      </div>
      
      <div className="flex rounded-lg border border-border p-0.5 mb-3">
        <button
          type="button"
          onClick={() => onSimulationChange({ 
            accountId: projection.account.id, 
            type: 'expense', 
            amount: isActive ? simulation?.amount : undefined 
          })}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            type === 'expense'
              ? 'bg-destructive/10 text-destructive'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('transactions.kind.expense')}
        </button>
        <button
          type="button"
          onClick={() => onSimulationChange({ 
            accountId: projection.account.id, 
            type: 'income', 
            amount: isActive ? simulation?.amount : undefined 
          })}
          className={`flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
            type === 'income'
              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          {t('transactions.kind.income')}
        </button>
      </div>
      
      <div className="space-y-2">
        <Label className="text-xs text-muted-foreground">{t('transactions.amount')}</Label>
        <MoneyInput
          value={isActive ? simulation?.amount : undefined}
          onChange={(value) => onSimulationChange({ 
            accountId: projection.account.id, 
            type, 
            amount: value 
          })}
          placeholder="0,00"
          className="h-9 text-sm"
        />
      </div>
      
      {hasSimulation && (
        <div className="mt-4 p-3 rounded-lg bg-muted/50 space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('projection.currentProjected')}</span>
            <span className="font-medium">{formatCurrency(projection.projectedBalance)}</span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">{t('projection.withSimulation')}</span>
            <span className={`font-semibold ${getTrendColor(projection.projectedBalance, simulatedProjected)}`}>
              {formatCurrency(simulatedProjected)}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
            <span className="text-muted-foreground">{t('projection.impact')}</span>
            <div className="flex items-center gap-1">
              <TrendIndicator current={projection.projectedBalance} projected={simulatedProjected} />
              <span className={`font-semibold ${getDeltaColor(impact, simulatedProjected)}`}>
                {impact >= 0 ? '+' : ''}{formatCurrency(impact)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AccountCard({ 
  projection,
  simulation,
  onSimulationChange,
  onClearSimulation,
  onNavigateToTransaction
}: { 
  projection: AccountProjection;
  simulation: SimulationState | null;
  onSimulationChange: (sim: SimulationState) => void;
  onClearSimulation: () => void;
  onNavigateToTransaction: (transactionId: string) => void;
}) {
  const { t, formatCurrency } = useLocale();
  const [isExpanded, setIsExpanded] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const delta = projection.projectedBalance - projection.realizedBalance;
  const hasDeltaDetails = projection.plannedIncomes.length > 0 || projection.plannedExpenses.length > 0;

  const isSimulationActive = simulation?.accountId === projection.account.id && (simulation?.amount ?? 0) > 0;
  const isPrimary = (projection.account as any).is_primary;

  const accountTypeLabel = projection.account.type === 'BANK' 
    ? t('accounts.types.BANK') 
    : projection.account.type === 'CARD' 
    ? t('accounts.types.CARD') 
    : t('accounts.types.CASH');

  return (
    <div
      className={`rounded-lg border transition-colors bg-background w-full min-w-0 overflow-hidden box-border ${
        isSimulationActive
          ? 'border-primary/50'
          : 'border-border'
      }`}
    >
      {/* Main Account Info */}
      <div className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <div className={`flex h-10 w-10 items-center justify-center rounded-full ${
            isPrimary ? 'bg-amber-500/10' : 'bg-muted'
          }`}>
            {isPrimary ? (
              <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
            ) : (
              <Building2 className="h-5 w-5 text-muted-foreground" />
            )}
          </div>
          <div>
            <p className="font-medium">{projection.account.name}</p>
            <p className="text-sm text-muted-foreground">
              {accountTypeLabel}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <p className="text-xs text-muted-foreground mb-0.5">{t('dashboard.currentBalance')}</p>
            <p className={`font-semibold ${
              projection.realizedBalance >= 0 
                ? 'text-foreground' 
                : 'text-destructive'
            }`}>
              {formatCurrency(projection.realizedBalance)}
            </p>
          </div>
        </div>
      </div>

      {/* Projected Balance Section */}
      <div className="px-4 pb-3 border-t border-border pt-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground mb-0.5">{t('projection.projectedBalance')}</p>
            <p className={`font-semibold ${
              projection.projectedBalance >= 0 
                ? getTrendColor(projection.realizedBalance, projection.projectedBalance)
                : 'text-destructive'
            }`}>
              {formatCurrency(projection.projectedBalance)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">Δ</span>
              <span className={`text-sm font-semibold ${getDeltaColor(delta, projection.projectedBalance)}`}>
                {delta >= 0 ? '+' : ''}{formatCurrency(delta)}
              </span>
            </div>
            <TrendIndicator 
              current={projection.realizedBalance} 
              projected={projection.projectedBalance} 
            />
          </div>
        </div>
      </div>

      {/* Delta Details Section */}
      {hasDeltaDetails && (
        <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
          <div className="px-4 pb-2">
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 px-2 text-xs w-full justify-center text-muted-foreground hover:text-foreground">
                {isExpanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5 mr-1" />
                    {t('projection.hideVariationDetails')}
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5 mr-1" />
                    {t('projection.showVariationDetails')}
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
          </div>
          
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-2 w-full min-w-0 overflow-hidden">
              {projection.plannedIncomes.length > 0 && (
                <TransactionList 
                  transactions={projection.plannedIncomes} 
                  type="income" 
                />
              )}
              {projection.plannedExpenses.length > 0 && (
                <TransactionList 
                  transactions={projection.plannedExpenses} 
                  type="expense" 
                />
              )}
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}

      {/* Simulator Toggle */}
      <Collapsible open={showSimulator} onOpenChange={setShowSimulator}>
        <div className="px-4 pb-2">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              size="sm" 
              className={`w-full h-8 text-xs justify-center ${
                isSimulationActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground'
              }`}
            >
              <Calculator className="h-3.5 w-3.5 mr-1.5" />
              {showSimulator ? t('projection.closeSimulator') : t('projection.simulateTransaction')}
              {isSimulationActive && !showSimulator && (
                <span className="ml-1.5 px-1.5 py-0.5 rounded bg-primary/10 text-primary text-[10px]">
                  {t('projection.active')}
                </span>
              )}
            </Button>
          </CollapsibleTrigger>
        </div>
        
        <CollapsibleContent>
          <QuickSimulator 
            projection={projection}
            simulation={simulation}
            onSimulationChange={onSimulationChange}
            onClear={onClearSimulation}
          />
        </CollapsibleContent>
      </Collapsible>

      {/* Smart Recommendations */}
      <SmartRecommendations 
        projection={projection}
        onNavigate={onNavigateToTransaction}
      />
    </div>
  );
}

// Helper to check if account is "relevant"
function isRelevantAccount(projection: AccountProjection): boolean {
  const { realizedBalance, projectedBalance, plannedIncomes, plannedExpenses } = projection;
  
  // Has current balance
  if (Math.abs(realizedBalance) > 0.01) return true;
  
  // Has projected change
  if (Math.abs(projectedBalance - realizedBalance) > 0.01) return true;
  
  // Has planned transactions
  if (plannedIncomes.length > 0 || plannedExpenses.length > 0) return true;
  
  return false;
}

export function ProjectionDrawer({ 
  open, 
  onOpenChange, 
  projections, 
  totals,
  projectionDateLabel 
}: ProjectionDrawerProps) {
  const navigate = useNavigate();
  const { t, formatCurrency } = useLocale();
  const [simulation, setSimulation] = useState<SimulationState | null>(null);
  const [filterMode, setFilterMode] = useState<FilterMode>('relevant');
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const totalDelta = totals.projectedBalance - totals.realizedBalance;

  // Filter and sort projections
  const filteredProjections = useMemo(() => {
    let filtered = filterMode === 'relevant' 
      ? projections.filter(isRelevantAccount)
      : projections;
    
    // Sort: primary first, then by |delta| desc, then by current balance desc
    return [...filtered].sort((a, b) => {
      const aIsPrimary = (a.account as any).is_primary ? 1 : 0;
      const bIsPrimary = (b.account as any).is_primary ? 1 : 0;
      
      // Primary first
      if (aIsPrimary !== bIsPrimary) return bIsPrimary - aIsPrimary;
      
      // By |delta| descending
      const aDelta = Math.abs(a.projectedBalance - a.realizedBalance);
      const bDelta = Math.abs(b.projectedBalance - b.realizedBalance);
      if (aDelta !== bDelta) return bDelta - aDelta;
      
      // By current balance descending
      return b.realizedBalance - a.realizedBalance;
    });
  }, [projections, filterMode]);

  // Reset index when filter changes or drawer opens
  useEffect(() => {
    if (open) {
      setCurrentIndex(0);
    }
  }, [open, filterMode]);

  // Ensure index is in bounds
  useEffect(() => {
    if (currentIndex >= filteredProjections.length && filteredProjections.length > 0) {
      setCurrentIndex(filteredProjections.length - 1);
    }
  }, [filteredProjections.length, currentIndex]);

  const currentProjection = filteredProjections[currentIndex];

  const handleNavigateToTransaction = (transactionId: string) => {
    onOpenChange(false);
    navigate(`/transactions?highlight=${transactionId}`);
  };

  // Calculate simulated totals
  const simulatedTotals = useMemo(() => {
    if (!simulation?.accountId || !simulation.amount) {
      return totals;
    }
    
    const impact = simulation.type === 'income' ? simulation.amount : -simulation.amount;
    return {
      ...totals,
      projectedBalance: totals.projectedBalance + impact,
    };
  }, [totals, simulation]);

  const hasActiveSimulation = simulation?.accountId && (simulation?.amount ?? 0) > 0;

  const handleClearSimulation = () => {
    setSimulation(null);
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setSimulation(null);
      setCurrentIndex(0);
    }
    onOpenChange(newOpen);
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
    }
  };

  const handleNext = () => {
    if (currentIndex < filteredProjections.length - 1) {
      setCurrentIndex(currentIndex + 1);
    }
  };

  const handleSelectAccount = (accountId: string) => {
    const index = filteredProjections.findIndex(p => p.account.id === accountId);
    if (index >= 0) {
      setCurrentIndex(index);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent className="w-full max-w-[420px] sm:max-w-[420px] max-h-[85vh] p-0 flex flex-col overflow-hidden box-border">
        {/* Fixed Header */}
        <SheetHeader className="flex-shrink-0 p-6 pb-4 border-b border-border w-full min-w-0 overflow-hidden">
          <SheetTitle className="text-lg truncate">{t('projection.title')}</SheetTitle>
          <SheetDescription className="truncate">
            {t('projection.projectedUntil', { date: projectionDateLabel })}
          </SheetDescription>
        </SheetHeader>
        
        {/* Controls Section */}
        {filteredProjections.length > 0 && (
          <div className="flex-shrink-0 px-6 py-3 border-b border-border space-y-3">
            {/* Account Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('transactions.account')}</Label>
              <Select 
                value={currentProjection?.account.id || ''} 
                onValueChange={handleSelectAccount}
              >
                <SelectTrigger className="w-full h-9">
                  <SelectValue placeholder={t('transactions.selectAccount')} />
                </SelectTrigger>
                <SelectContent>
                  {filteredProjections.map((p) => (
                    <SelectItem key={p.account.id} value={p.account.id}>
                      <div className="flex items-center gap-2">
                        {(p.account as any).is_primary && (
                          <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                        )}
                        <span>{p.account.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center justify-between">
              <Label className="text-xs text-muted-foreground">{t('projection.show')}</Label>
              <div className="flex rounded-lg border border-border p-0.5">
                <button
                  type="button"
                  onClick={() => setFilterMode('relevant')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterMode === 'relevant'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('projection.relevant')}
                </button>
                <button
                  type="button"
                  onClick={() => setFilterMode('all')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                    filterMode === 'all'
                      ? 'bg-primary text-primary-foreground'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('common.all')}
                </button>
              </div>
            </div>

            {/* Navigation Controls */}
            <div className="flex items-center justify-between">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevious}
                disabled={currentIndex === 0}
                className="h-8 px-3"
              >
                <ChevronLeft className="h-4 w-4 mr-1" />
                {t('common.previous')}
              </Button>
              <span className="text-sm text-muted-foreground">
                {t('projection.accountOf', { current: currentIndex + 1, total: filteredProjections.length })}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNext}
                disabled={currentIndex >= filteredProjections.length - 1}
                className="h-8 px-3"
              >
                {t('common.next')}
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </div>
        )}
        
        {/* Scrollable Content - Single Account */}
        <ScrollArea className="flex-1 w-full min-w-0 overflow-x-hidden">
          <div className="py-4 px-6 w-full min-w-0 overflow-hidden box-border">
            {filteredProjections.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">
                {filterMode === 'relevant' 
                  ? t('projection.noRelevantAccounts')
                  : t('projection.noAccounts')}
              </p>
            ) : currentProjection ? (
              <AccountCard 
                projection={currentProjection}
                simulation={simulation}
                onSimulationChange={setSimulation}
                onClearSimulation={handleClearSimulation}
                onNavigateToTransaction={handleNavigateToTransaction}
              />
            ) : null}
          </div>
        </ScrollArea>
        
        {/* Fixed Footer with Totals */}
        {projections.length > 0 && (
          <div className="flex-shrink-0 p-6 pt-4 border-t border-border bg-background">
            <div className={`p-4 rounded-lg space-y-3 ${
              hasActiveSimulation ? 'bg-primary/5 border border-primary/20' : 'bg-muted/50'
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">{t('projection.totalConsolidated')}</p>
                  <p className="text-sm text-muted-foreground">
                    {hasActiveSimulation ? t('projection.withSimulation') : t('projection.allAccounts')}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className={`text-lg font-bold ${
                      simulatedTotals.realizedBalance >= 0 
                        ? 'text-foreground' 
                        : 'text-destructive'
                    }`}>
                      {formatCurrency(simulatedTotals.realizedBalance)}
                    </p>
                    <p className={`text-sm font-medium ${getTrendColor(simulatedTotals.realizedBalance, simulatedTotals.projectedBalance)}`}>
                      {formatCurrency(simulatedTotals.projectedBalance)}
                    </p>
                  </div>
                  <TrendIndicator 
                    current={simulatedTotals.realizedBalance} 
                    projected={simulatedTotals.projectedBalance} 
                  />
                </div>
              </div>
              
              {/* Total Delta */}
              <div className="pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {hasActiveSimulation ? t('projection.totalVariationWithSimulation') : t('projection.totalVariation')}
                  </span>
                  <span className={`font-semibold ${getDeltaColor(
                    simulatedTotals.projectedBalance - simulatedTotals.realizedBalance, 
                    simulatedTotals.projectedBalance
                  )}`}>
                    {(simulatedTotals.projectedBalance - simulatedTotals.realizedBalance) >= 0 ? '+' : ''}
                    {formatCurrency(simulatedTotals.projectedBalance - simulatedTotals.realizedBalance)}
                  </span>
                </div>
              </div>

              {/* Clear simulation button in footer */}
              {hasActiveSimulation && (
                <div className="pt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs"
                    onClick={handleClearSimulation}
                  >
                    <X className="h-3.5 w-3.5 mr-1.5" />
                    {t('projection.clearSimulation')}
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
