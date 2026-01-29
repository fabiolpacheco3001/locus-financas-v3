import { useState, useMemo } from 'react';
import { Navigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { StickyHeaderFilters } from '@/components/layout/StickyHeaderFilters';
import { MonthPicker } from '@/components/ui/month-picker';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useTransactions } from '@/hooks/useTransactions';
import { useCategories } from '@/hooks/useCategories';
import { useBudgets } from '@/hooks/useBudgets';
import { useAccountProjections } from '@/hooks/useAccountProjections';
import { useBudgetAlerts } from '@/hooks/useBudgetAlerts';
import { useRiskDetection } from '@/hooks/useRiskDetection';
import { useDeterministicInsights } from '@/hooks/useDeterministicInsights';
import { useRiskNotifications } from '@/hooks/useRiskNotifications';
import { useAIDecisionNotifications } from '@/hooks/useAIDecisionNotifications';
import { useFutureEngine } from '@/hooks/useFutureEngine';
import { ProjectionDrawer } from '@/components/dashboard/ProjectionDrawer';
import { InsightsCard } from '@/components/dashboard/InsightsCard';
import { HeroBalance } from '@/components/dashboard/HeroBalance';
import { GlassStatCard } from '@/components/dashboard/GlassStatCard';
import { BalanceAreaChart } from '@/components/dashboard/BalanceAreaChart';
import { CategoryPieChart } from '@/components/dashboard/CategoryPieChart';
import { TransactionTimeline } from '@/components/dashboard/TransactionTimeline';
import { StaggeredContainer, StaggeredItem } from '@/components/dashboard/AnimatedCard';
import { MaturityRadar } from '@/components/dashboard/MaturityRadar';
import { FutureEngineWidget } from '@/components/dashboard/FutureEngineWidget';
import { useLocale } from '@/i18n/useLocale';
import { 
  TrendingUp, TrendingDown, Loader2, 
  PiggyBank, Calendar, AlertCircle, Clock, Wallet, 
  AlertTriangle, ChevronRight, Landmark
} from 'lucide-react';
import { getMonth, getYear, subDays, isAfter, parseISO, addDays, isWithinInterval, startOfDay, endOfMonth } from 'date-fns';

export default function Dashboard() {
  const { user, loading, member } = useAuth();
  const { t, formatCurrency, formatDate, formatMonthYear, formatDateShort } = useLocale();
  const [selectedMonth, setSelectedMonth] = useState(new Date());
  const [upcomingDays, setUpcomingDays] = useState<7 | 15 | 30>(7);
  const [projectionDrawerOpen, setProjectionDrawerOpen] = useState(false);
  const { transactions, monthlyStats, isLoading } = useTransactions({ month: selectedMonth });
  const { categories } = useCategories();
  const { budgets } = useBudgets(getYear(selectedMonth), getMonth(selectedMonth) + 1);
  
  // Account projections - SINGLE SOURCE OF TRUTH for all balance calculations
  const { projections, negativeProjectedAccounts, totals, isLoading: projectionsLoading } = useAccountProjections(selectedMonth);
  
  // Budget alerts
  const { alerts: budgetAlerts, overBudgetCount, warningCount } = useBudgetAlerts(transactions, budgets, categories);

  // Risk detection
  const riskDetection = useRiskDetection({
    projections,
    transactions,
    selectedMonth,
    enabled: !isLoading && !projectionsLoading,
  });

  // Risk indicators
  const riskIndicators = useRiskNotifications({
    projectedBalance: totals.projectedBalance,
    realizedBalance: totals.realizedBalance,
    pendingExpenses: totals.pendingExpenses,
    transactions,
    selectedMonth,
    enabled: !isLoading && !projectionsLoading,
  });

  // AI Decision indicators
  const aiIndicators = useAIDecisionNotifications({
    transactions,
    selectedMonth,
    enabled: !isLoading && !projectionsLoading,
  });

  // Deterministic insights
  const insights = useDeterministicInsights({
    projections,
    totals,
    transactions,
    selectedMonth,
  });

  // Future Engine - End of Month Projection
  const pendingFixedExpenses = useMemo(() => {
    return transactions
      .filter(t => t.kind === 'EXPENSE' && t.expense_type === 'fixed' && t.status === 'planned')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  const confirmedVariableThisMonth = useMemo(() => {
    return transactions
      .filter(t => t.kind === 'EXPENSE' && t.expense_type === 'variable' && t.status === 'confirmed')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [transactions]);

  const futureEngine = useFutureEngine({
    selectedMonth,
    currentBalance: totals.availableRealizedBalance,
    pendingFixedExpenses,
    confirmedVariableThisMonth,
  });

  // Calculate total budget planned and used
  const totalBudgetPlanned = budgets.reduce((sum, b) => sum + Number(b.planned_amount), 0);
  const totalBudgetUsed = transactions
    .filter(t => t.kind === 'EXPENSE' && t.status === 'confirmed')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const getBudgetStatus = () => {
    if (totalBudgetPlanned === 0) return { status: 'neutral', label: '' };
    const ratio = totalBudgetUsed / totalBudgetPlanned;
    if (ratio > 1) return { status: 'over', label: t('dashboard.budgetStatus.over') };
    if (ratio > 0.8) return { status: 'warning', label: t('dashboard.budgetStatus.warning') };
    return { status: 'ok', label: t('dashboard.budgetStatus.ok') };
  };

  const budgetStatus = getBudgetStatus();

  // Upcoming due expenses
  const upcomingDueExpenses = useMemo(() => {
    const today = startOfDay(new Date());
    const endDate = addDays(today, upcomingDays);
    
    return transactions.filter(t => {
      if (t.kind !== 'EXPENSE') return false;
      if (t.expense_type !== 'fixed') return false;
      if (t.status !== 'planned') return false;
      if (!t.due_date) return false;
      
      const dueDate = parseISO(t.due_date);
      return isWithinInterval(dueDate, { start: today, end: endDate });
    }).sort((a, b) => {
      const dateA = parseISO(a.due_date!);
      const dateB = parseISO(b.due_date!);
      return dateA.getTime() - dateB.getTime();
    });
  }, [transactions, upcomingDays]);

  const upcomingTotal = upcomingDueExpenses.reduce((sum, t) => sum + Number(t.amount), 0);

  // Weekly summary
  const weeklySummary = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    
    const weekTransactions = transactions.filter(t => {
      const transactionDate = parseISO(t.date);
      return t.kind === 'EXPENSE' && t.status === 'confirmed' && isAfter(transactionDate, sevenDaysAgo);
    });

    const totalSpent = weekTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionCount = weekTransactions.length;

    const categorySpending: Record<string, { name: string; amount: number; categoryId: string }> = {};
    weekTransactions.forEach(t => {
      if (t.category_id && t.category) {
        const catId = t.category_id;
        if (!categorySpending[catId]) {
          categorySpending[catId] = { name: t.category.name, amount: 0, categoryId: catId };
        }
        categorySpending[catId].amount += Number(t.amount);
      }
    });

    const topCategory = Object.values(categorySpending).sort((a, b) => b.amount - a.amount)[0] || null;

    return { totalSpent, transactionCount, topCategory };
  }, [transactions]);

  // Top expense categories
  const topCategories = useMemo(() => {
    const noCategory = t('common.noCategory');
    const categoryExpenses = transactions
      .filter(tx => tx.kind === 'EXPENSE' && tx.status === 'confirmed' && tx.category)
      .reduce((acc, tx) => {
        const catName = tx.category?.name || noCategory;
        acc[catName] = (acc[catName] || 0) + Number(tx.amount);
        return acc;
      }, {} as Record<string, number>);

    return Object.entries(categoryExpenses)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: monthlyStats.expenses > 0 ? (amount / monthlyStats.expenses) * 100 : 0
      }));
  }, [transactions, monthlyStats.expenses, t]);

  // Recent transactions
  const recentTransactions = useMemo(() => transactions.slice(0, 5), [transactions]);

  // Calculate balance trend
  const balanceTrend = useMemo(() => {
    if (monthlyStats.income > monthlyStats.expenses) return 'up';
    if (monthlyStats.income < monthlyStats.expenses) return 'down';
    return 'neutral';
  }, [monthlyStats]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const endOfMonthDate = endOfMonth(selectedMonth);
  const projectionDateLabel = formatDateShort(endOfMonthDate);

  return (
    <AppLayout>
      <StickyHeaderFilters
        titleKey="dashboard.title"
        monthControl={
          <MonthPicker 
            value={selectedMonth} 
            onChange={setSelectedMonth}
            data-testid="dashboard-month-picker"
          />
        }
      />

      {isLoading || projectionsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Hero Balance Section - CARD 2: Patrimônio Acumulado (Total Assets) */}
          <HeroBalance
            memberName={member?.name}
            balance={totals.realizedBalance}
            trend={balanceTrend}
            subtitle={t('dashboard.totalAssetsSubtitle')}
            tooltip={t('dashboard.totalAssetsTooltip')}
            label={t('dashboard.totalAssets')}
          />

          {/* Maturity Radar - Due dates health check */}
          <MaturityRadar />

          {/* Future Engine - End of Month Projection */}
          <div className="mb-6">
            <FutureEngineWidget data={futureEngine} />
          </div>

          {/* Stats Cards - 3 Main Cards with Unified Logic */}
          <StaggeredContainer className="mb-4 grid gap-2 sm:gap-3 grid-cols-1 sm:grid-cols-3">
            {/* CARD 1: Saldo Disponível (Operational Cash - excludes reserves) */}
            <StaggeredItem>
              <GlassStatCard
                title={t('dashboard.availableBalance')}
                value={formatCurrency(totals.availableRealizedBalance)}
                icon={Wallet}
                colorScheme={totals.availableRealizedBalance >= 0 ? 'primary' : 'destructive'}
                tooltip={t('dashboard.availableBalanceTooltip')}
                trendLabel={totals.reserveRealizedBalance > 0 
                  ? `${formatCurrency(totals.reserveRealizedBalance)} ${t('dashboard.inReserves')}`
                  : undefined
                }
                compact
              />
            </StaggeredItem>
            
            {/* CARD 2 (secondary): Patrimônio Acumulado - already shown in Hero, show reserves here */}
            <StaggeredItem>
              <GlassStatCard
                title={t('dashboard.reserves')}
                value={formatCurrency(totals.reserveRealizedBalance)}
                icon={PiggyBank}
                colorScheme="warning"
                tooltip={t('dashboard.reservesTooltip')}
                compact
              />
            </StaggeredItem>
            
            {/* CARD 3: Previsão de Fechamento (Forecast - available + pending) */}
            <StaggeredItem>
              <GlassStatCard
                title={t('dashboard.closingForecast')}
                value={formatCurrency(totals.availableProjectedBalance)}
                icon={TrendingUp}
                colorScheme={totals.availableProjectedBalance >= 0 ? 'success' : 'destructive'}
                tooltip={t('dashboard.closingForecastTooltip')}
                trendLabel={(() => {
                  const diff = totals.availableProjectedBalance - totals.availableRealizedBalance;
                  if (Math.abs(diff) < 0.01) return undefined;
                  const sign = diff > 0 ? '+' : '';
                  return `${sign}${formatCurrency(diff)}`;
                })()}
                compact
              />
            </StaggeredItem>
          </StaggeredContainer>
          
          
          {/* Secondary Stats Row: Income & Expenses - Using unified source from useAccountProjections */}
          <StaggeredContainer className="mb-4 grid gap-2 sm:gap-3 grid-cols-2">
            <StaggeredItem>
              <GlassStatCard
                title={t('dashboard.income')}
                value={formatCurrency(monthlyStats.income)}
                icon={TrendingUp}
                colorScheme="success"
                trendLabel={totals.pendingIncome > 0 
                  ? `+${formatCurrency(totals.pendingIncome)} ${t('dashboard.toReceive')}`
                  : t('dashboard.confirmedInMonth')
                }
                compact
              />
            </StaggeredItem>
            <StaggeredItem>
              <GlassStatCard
                title={t('dashboard.expenses')}
                value={formatCurrency(monthlyStats.expenses)}
                icon={TrendingDown}
                colorScheme="destructive"
                trendLabel={totals.pendingExpenses > 0 
                  ? `+${formatCurrency(totals.pendingExpenses)} ${t('dashboard.toPay')}`
                  : t('dashboard.confirmedInMonth')
                }
                compact
              />
            </StaggeredItem>
          </StaggeredContainer>


          {/* Balance Evolution Chart */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.3 }}
          >
            <Card className="mb-6 bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  {t('dashboard.balanceEvolution')}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <BalanceAreaChart 
                  transactions={transactions} 
                  initialBalance={totals.realizedBalance - monthlyStats.balance}
                />
              </CardContent>
            </Card>
          </motion.div>

          {/* Quick Actions Bar - Account Details */}
          {(negativeProjectedAccounts.length > 0 || projections.length > 1) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.3 }}
              className="mb-4"
            >
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/50 bg-card/50 px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <Landmark className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {t('dashboard.accountsSummary', { count: projections.length })}
                  </span>
                  {negativeProjectedAccounts.length > 0 && (
                    <Badge variant="destructive" className="gap-1 text-xs">
                      <AlertTriangle className="h-3 w-3" />
                      {negativeProjectedAccounts.length} {t('dashboard.atRisk')}
                    </Badge>
                  )}
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setProjectionDrawerOpen(true)}
                  className="gap-1 h-7 text-xs"
                >
                  {t('common.seeByAccount')}
                  <ChevronRight className="h-3.5 w-3.5" />
                </Button>
              </div>
            </motion.div>
          )}

          <ProjectionDrawer
            open={projectionDrawerOpen}
            onOpenChange={setProjectionDrawerOpen}
            projections={projections}
            totals={totals}
            projectionDateLabel={projectionDateLabel}
          />

          {/* Insights Card */}
          {insights.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
              className="mb-6"
            >
              <InsightsCard insights={insights} />
            </motion.div>
          )}

          {/* Charts Row */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Expense Distribution Pie Chart */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.5 }}
            >
              <Card className="h-full bg-card/80 backdrop-blur-md border-border/50">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <PiggyBank className="h-5 w-5 text-primary" />
                    {t('dashboard.expenseDistribution')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CategoryPieChart categories={topCategories} />
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent Transactions Timeline */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.6 }}
            >
              <Card className="h-full bg-card/80 backdrop-blur-md border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Calendar className="h-5 w-5 text-primary" />
                      {t('dashboard.recentTransactions.title')}
                    </CardTitle>
                    <Link to="/transactions">
                      <Button variant="ghost" size="sm" className="gap-1 text-xs">
                        {t('common.viewTransactions')}
                        <ChevronRight className="h-3 w-3" />
                      </Button>
                    </Link>
                  </div>
                </CardHeader>
                <CardContent>
                  <TransactionTimeline transactions={recentTransactions} />
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Alerts Section */}
          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            {/* Upcoming Due Expenses */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.7 }}
            >
              <Card className="bg-card/80 backdrop-blur-md border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-warning" />
                      <CardTitle className="text-lg">{t('dashboard.upcomingDue.title')}</CardTitle>
                      {upcomingDueExpenses.length > 0 && (
                        <Badge className="bg-warning/20 text-warning border-warning/30">
                          {upcomingDueExpenses.length} {t('dashboard.upcomingDue.toPay')}
                        </Badge>
                      )}
                    </div>
                    <div className="flex gap-1">
                      {([7, 15, 30] as const).map((days) => (
                        <Button
                          key={days}
                          variant={upcomingDays === days ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setUpcomingDays(days)}
                          className="h-7 px-2 text-xs"
                        >
                          {days}d
                        </Button>
                      ))}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {upcomingDueExpenses.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      {t('dashboard.upcomingDue.noBillsInDays', { days: upcomingDays })}
                    </p>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {upcomingDueExpenses.slice(0, 5).map((t_item) => (
                          <div
                            key={t_item.id}
                            className="flex items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3"
                          >
                            <div className="flex items-center gap-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-warning/20">
                                <Calendar className="h-4 w-4 text-warning" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">
                                  {t_item.description || t_item.category?.name || t('dashboard.upcomingDue.billToPay')}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {t('dashboard.upcomingDue.due')}: {formatDateShort(t_item.due_date!)}
                                </p>
                              </div>
                            </div>
                            <span className="font-bold text-warning">
                              {formatCurrency(Number(t_item.amount))}
                            </span>
                          </div>
                        ))}
                      </div>
                      {upcomingDueExpenses.length > 5 && (
                        <p className="text-center text-xs text-muted-foreground mt-2">
                          {t('dashboard.upcomingDue.moreBills', { count: upcomingDueExpenses.length - 5 })}
                        </p>
                      )}
                      <div className="mt-4 pt-3 border-t border-border flex justify-between items-center">
                        <span className="text-sm text-muted-foreground">{t('dashboard.upcomingDue.totalToPay', { days: upcomingDays })}</span>
                        <span className="text-lg font-bold text-warning">
                          {formatCurrency(upcomingTotal)}
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Budget Alerts */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.8 }}
            >
              <Card className="bg-card/80 backdrop-blur-md border-border/50">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <AlertCircle className={`h-5 w-5 ${
                      overBudgetCount > 0 
                        ? 'text-destructive' 
                        : warningCount > 0 
                        ? 'text-warning' 
                        : 'text-muted-foreground'
                    }`} />
                    <CardTitle className="text-lg">{t('dashboard.budgetRisk.title')}</CardTitle>
                    {overBudgetCount > 0 && (
                      <Badge variant="destructive">
                        {t('dashboard.budgetRisk.exceeded', { count: overBudgetCount })}
                      </Badge>
                    )}
                    {warningCount > 0 && (
                      <Badge className="bg-warning/20 text-warning border-warning/30">
                        {t('dashboard.budgetRisk.attention', { count: warningCount })}
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  {budgetAlerts.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      {t('dashboard.budgetRisk.noCategoryAtRisk')}
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {budgetAlerts.slice(0, 5).map((alert) => (
                        <div
                          key={`${alert.categoryId}-${alert.subcategoryId || 'null'}`}
                          className={`rounded-lg border p-3 ${
                            alert.status === 'over'
                              ? 'border-destructive/30 bg-destructive/5'
                              : 'border-warning/30 bg-warning/5'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <p className="font-medium text-sm">
                                {alert.categoryName}
                                {alert.subcategoryName && (
                                  <span className="text-muted-foreground"> / {alert.subcategoryName}</span>
                                )}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {t('dashboard.budgetRisk.budget')}: {formatCurrency(alert.budgetAmount)}
                              </p>
                            </div>
                            <Badge 
                              variant={alert.status === 'over' ? 'destructive' : 'outline'}
                              className={alert.status !== 'over' ? 'border-warning/50 text-warning bg-warning/10' : ''}
                            >
                              {Math.round(alert.percentUsed)}%
                            </Badge>
                          </div>
                          <div className="h-2 rounded-full bg-muted overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all ${
                                alert.status === 'over' ? 'bg-destructive' : 'bg-warning'
                              }`}
                              style={{ width: `${Math.min(alert.percentUsed, 100)}%` }}
                            />
                          </div>
                          <div className="flex justify-between text-xs text-muted-foreground mt-1">
                            <span>{t('dashboard.budgetRisk.realized')}: {formatCurrency(alert.realizedAmount)}</span>
                            {alert.pendingAmount > 0 && (
                              <span>+ {t('dashboard.budgetRisk.pending')}: {formatCurrency(alert.pendingAmount)}</span>
                            )}
                          </div>
                        </div>
                      ))}
                      {budgetAlerts.length > 5 && (
                        <p className="text-center text-xs text-muted-foreground">
                          {t('dashboard.budgetRisk.moreCategoriesAlert', { count: budgetAlerts.length - 5 })}
                        </p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Weekly Summary */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.9 }}
          >
            <Card className="mb-6 bg-card/80 backdrop-blur-md border-border/50">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{t('dashboard.weekly.title')}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">{t('dashboard.weekly.totalSpent')}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {formatCurrency(weeklySummary.totalSpent)}
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">{t('dashboard.weekly.transactions')}</p>
                    <p className="text-2xl font-bold text-foreground">
                      {weeklySummary.transactionCount}
                    </p>
                  </div>
                  <div className="text-center sm:text-left">
                    <p className="text-sm text-muted-foreground">{t('dashboard.weekly.topCategory')}</p>
                    <p className="text-lg font-semibold text-foreground">
                      {weeklySummary.topCategory?.name || '-'}
                    </p>
                    {weeklySummary.topCategory && (
                      <p className="text-xs text-muted-foreground">
                        {formatCurrency(weeklySummary.topCategory.amount)}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

        </>
      )}
    </AppLayout>
  );
}
