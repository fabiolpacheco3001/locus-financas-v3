import { useState, useCallback, useMemo } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { 
  Upload, FileSpreadsheet, Check, X, Loader2, AlertCircle, 
  ChevronDown, ChevronUp, Tag, Sparkles, Edit2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { CategorySelector } from './CategorySelector';
import { useLocale } from '@/i18n/useLocale';
import { useCategories } from '@/hooks/useCategories';
import { useAccounts } from '@/hooks/useAccounts';
import { useTransactions } from '@/hooks/useTransactions';
import { categorizeTransactions, CategoryMatch } from '@/lib/smartCategorizer';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  isExpense: boolean;
  suggestedCategoryId: string | null;
  suggestedCategoryName: string | null;
  match: CategoryMatch | null;
  overrideCategoryId?: string;
}

interface CategoryGroup {
  categoryId: string | null;
  categoryName: string;
  confidence: 'high' | 'medium' | 'low' | 'none';
  transactions: ParsedTransaction[];
  isExpanded: boolean;
}

interface SmartImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SmartImportDialog({ open, onOpenChange }: SmartImportDialogProps) {
  const { t, formatCurrency } = useLocale();
  const { activeCategories } = useCategories();
  const { accounts } = useAccounts();
  const { createTransaction } = useTransactions();
  
  const [step, setStep] = useState<'upload' | 'review' | 'importing' | 'success'>('upload');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [editingTransaction, setEditingTransaction] = useState<string | null>(null);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });

  const defaultAccount = accounts.find(a => a.is_primary) || accounts[0];

  const parseFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const isOFX = file.name.toLowerCase().endsWith('.ofx');

    if (isOFX) {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const transactions: ParsedTransaction[] = [];
          
          const stmtTrnRegex = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi;
          let match;
          let id = 0;
          
          while ((match = stmtTrnRegex.exec(content)) !== null) {
            const block = match[1];
            const dtPosted = block.match(/<DTPOSTED>(\d{8})/)?.[1];
            const trnAmt = block.match(/<TRNAMT>([^<\n]+)/)?.[1];
            const memo = block.match(/<MEMO>([^<\n]+)/)?.[1] || block.match(/<NAME>([^<\n]+)/)?.[1];
            
            if (dtPosted && trnAmt) {
              const year = dtPosted.substring(0, 4);
              const month = dtPosted.substring(4, 6);
              const day = dtPosted.substring(6, 8);
              const date = `${year}-${month}-${day}`;
              const amount = parseFloat(trnAmt.replace(',', '.'));
              
              transactions.push({
                id: `tx-${id++}`,
                date,
                description: memo?.trim() || 'Transação importada',
                amount: Math.abs(amount),
                isExpense: amount < 0,
                suggestedCategoryId: null,
                suggestedCategoryName: null,
                match: null,
              });
            }
          }
          
          if (transactions.length === 0) {
            setError(t('smartImport.noTransactionsFound'));
          } else {
            applyCategorization(transactions);
          }
        } catch (err) {
          setError(t('smartImport.parseError'));
        }
      };
      reader.readAsText(file);
    } else {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(t('smartImport.parseError'));
            return;
          }

          const transactions: ParsedTransaction[] = results.data.map((row: any, index) => {
            const dateCol = Object.keys(row).find(k => 
              k.toLowerCase().includes('data') || k.toLowerCase().includes('date')
            );
            const descCol = Object.keys(row).find(k => 
              k.toLowerCase().includes('desc') || k.toLowerCase().includes('memo') || k.toLowerCase().includes('hist')
            );
            const amountCol = Object.keys(row).find(k => 
              k.toLowerCase().includes('valor') || k.toLowerCase().includes('amount') || k.toLowerCase().includes('value')
            );

            const rawDate = dateCol ? row[dateCol] : '';
            const description = descCol ? row[descCol] : Object.values(row)[1] || '';
            const rawAmount = amountCol ? row[amountCol] : Object.values(row)[2] || '0';

            let parsedDate = '';
            if (rawDate) {
              const match1 = rawDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (match1) {
                parsedDate = `${match1[3]}-${match1[2]}-${match1[1]}`;
              }
              const match2 = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
              if (match2) {
                parsedDate = rawDate;
              }
            }

            const cleanAmount = String(rawAmount)
              .replace(/[R$\s]/g, '')
              .replace(/\./g, '')
              .replace(',', '.');
            const amount = parseFloat(cleanAmount);
            const isExpense = amount < 0 || rawAmount.includes('-');

            return {
              id: `tx-${index}`,
              date: parsedDate || format(new Date(), 'yyyy-MM-dd'),
              description: String(description).trim(),
              amount: Math.abs(amount) || 0,
              isExpense,
              suggestedCategoryId: null,
              suggestedCategoryName: null,
              match: null,
            };
          });

          if (transactions.length === 0) {
            setError(t('smartImport.noTransactionsFound'));
          } else {
            applyCategorization(transactions);
          }
        },
        error: () => {
          setError(t('smartImport.parseError'));
        },
      });
    }
  }, [t, activeCategories]);

  const applyCategorization = (transactions: ParsedTransaction[]) => {
    const categorized = categorizeTransactions(
      transactions,
      activeCategories.map(c => ({ id: c.id, name: c.name }))
    );
    
    const enhancedTransactions: ParsedTransaction[] = categorized.map(({ transaction, match, categoryId }) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      amount: transaction.amount,
      isExpense: transaction.isExpense,
      suggestedCategoryId: categoryId,
      suggestedCategoryName: match?.categoryName || null,
      match,
    }));
    
    setParsedTransactions(enhancedTransactions);
    setStep('review');
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/x-ofx': ['.ofx'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        parseFile(acceptedFiles[0]);
      }
    },
  });

  // Group transactions by category
  const categoryGroups = useMemo((): CategoryGroup[] => {
    const groups = new Map<string, CategoryGroup>();
    
    parsedTransactions.forEach(tx => {
      const categoryId = tx.overrideCategoryId || tx.suggestedCategoryId || 'uncategorized';
      const categoryName = tx.overrideCategoryId 
        ? activeCategories.find(c => c.id === tx.overrideCategoryId)?.name || t('smartImport.uncategorized')
        : tx.suggestedCategoryName || t('smartImport.uncategorized');
      
      if (!groups.has(categoryId)) {
        groups.set(categoryId, {
          categoryId: categoryId === 'uncategorized' ? null : categoryId,
          categoryName,
          confidence: tx.match?.confidence || 'none',
          transactions: [],
          isExpanded: expandedGroups.has(categoryId),
        });
      }
      groups.get(categoryId)!.transactions.push(tx);
    });
    
    // Sort by confidence and then by transaction count
    return Array.from(groups.values()).sort((a, b) => {
      const confidenceOrder = { high: 0, medium: 1, low: 2, none: 3 };
      const confDiff = confidenceOrder[a.confidence] - confidenceOrder[b.confidence];
      if (confDiff !== 0) return confDiff;
      return b.transactions.length - a.transactions.length;
    });
  }, [parsedTransactions, expandedGroups, activeCategories, t]);

  const toggleGroup = (categoryId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(categoryId)) {
        next.delete(categoryId);
      } else {
        next.add(categoryId);
      }
      return next;
    });
  };

  const updateTransactionCategory = (txId: string, categoryId: string) => {
    setParsedTransactions(prev => 
      prev.map(tx => tx.id === txId ? { ...tx, overrideCategoryId: categoryId } : tx)
    );
    setEditingTransaction(null);
  };

  const handleConfirmAll = async () => {
    if (!defaultAccount) {
      toast.error(t('smartImport.noDefaultAccount'));
      return;
    }
    
    setStep('importing');
    setImportProgress({ current: 0, total: parsedTransactions.length });
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < parsedTransactions.length; i++) {
      const tx = parsedTransactions[i];
      setImportProgress({ current: i + 1, total: parsedTransactions.length });
      
      try {
        await createTransaction.mutateAsync({
          date: tx.date,
          due_date: tx.date,
          amount: tx.amount,
          description: tx.description,
          kind: tx.isExpense ? 'EXPENSE' : 'INCOME',
          status: 'confirmed',
          account_id: defaultAccount.id,
          category_id: tx.overrideCategoryId || tx.suggestedCategoryId || undefined,
        });
        successCount++;
      } catch (err) {
        console.error('Failed to import transaction:', err);
        errorCount++;
      }
    }
    
    setStep('success');
    
    // Show success toast with learning message
    setTimeout(() => {
      toast.success(t('smartImport.successTitle'), {
        description: t('smartImport.successMessage', { count: successCount }),
        duration: 5000,
      });
      
      if (errorCount === 0) {
        toast(t('smartImport.learningMessage'), {
          icon: <Sparkles className="h-4 w-4 text-primary" />,
          duration: 4000,
        });
      }
    }, 500);
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('upload');
    setParsedTransactions([]);
    setError(null);
    setExpandedGroups(new Set());
  };

  const getConfidenceBadge = (confidence: CategoryMatch['confidence'] | 'none') => {
    switch (confidence) {
      case 'high':
        return <Badge variant="default" className="bg-success/20 text-success border-success/30">{t('smartImport.confidence.high')}</Badge>;
      case 'medium':
        return <Badge variant="secondary" className="bg-warning/20 text-warning border-warning/30">{t('smartImport.confidence.medium')}</Badge>;
      case 'low':
        return <Badge variant="outline" className="text-muted-foreground">{t('smartImport.confidence.low')}</Badge>;
      default:
        return <Badge variant="outline" className="text-muted-foreground">{t('smartImport.confidence.none')}</Badge>;
    }
  };

  const totalAmount = parsedTransactions.reduce((sum, tx) => 
    sum + (tx.isExpense ? -tx.amount : tx.amount), 0
  );
  const categorizedCount = parsedTransactions.filter(tx => 
    tx.overrideCategoryId || tx.suggestedCategoryId
  ).length;

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            {t('smartImport.title')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === 'upload' && t('smartImport.uploadDescription')}
            {step === 'review' && t('smartImport.reviewDescription')}
            {step === 'importing' && t('smartImport.importingDescription')}
            {step === 'success' && t('smartImport.successDescription')}
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>

        {step === 'upload' && (
          <div className="p-4">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors min-h-[160px] flex flex-col items-center justify-center",
                isDragActive
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-primary/50 hover:bg-muted/50"
              )}
            >
              <input {...getInputProps()} />
              <Upload className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium">{t('smartImport.dropzone')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('smartImport.supportedFormats')}
              </p>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'review' && (
          <div className="p-4 space-y-4">
            {/* Summary Stats */}
            <div className="grid grid-cols-3 gap-2 p-3 bg-muted/50 rounded-lg">
              <div className="text-center">
                <p className="text-2xl font-bold">{parsedTransactions.length}</p>
                <p className="text-xs text-muted-foreground">{t('smartImport.transactions')}</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-success">{categorizedCount}</p>
                <p className="text-xs text-muted-foreground">{t('smartImport.categorized')}</p>
              </div>
              <div className="text-center">
                <p className={cn("text-2xl font-bold", totalAmount >= 0 ? "text-success" : "text-destructive")}>
                  {formatCurrency(Math.abs(totalAmount))}
                </p>
                <p className="text-xs text-muted-foreground">{totalAmount >= 0 ? t('smartImport.netPositive') : t('smartImport.netNegative')}</p>
              </div>
            </div>

            {/* Category Groups */}
            <ScrollArea className="h-[300px]">
              <div className="space-y-2">
                {categoryGroups.map((group) => (
                  <Collapsible
                    key={group.categoryId || 'uncategorized'}
                    open={expandedGroups.has(group.categoryId || 'uncategorized')}
                    onOpenChange={() => toggleGroup(group.categoryId || 'uncategorized')}
                  >
                    <CollapsibleTrigger asChild>
                      <button
                        className={cn(
                          "w-full flex items-center justify-between p-3 rounded-lg transition-colors min-h-[52px]",
                          "bg-card border border-border hover:bg-muted/50"
                        )}
                      >
                        <div className="flex items-center gap-2">
                          <Tag className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{group.categoryName}</span>
                          <Badge variant="secondary" className="text-xs">
                            {group.transactions.length}
                          </Badge>
                          {getConfidenceBadge(group.confidence)}
                        </div>
                        {expandedGroups.has(group.categoryId || 'uncategorized') 
                          ? <ChevronUp className="h-4 w-4" />
                          : <ChevronDown className="h-4 w-4" />
                        }
                      </button>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <div className="mt-1 ml-4 space-y-1">
                        {group.transactions.map((tx) => (
                          <div
                            key={tx.id}
                            className="flex items-center justify-between p-2 rounded-lg bg-muted/30 min-h-[44px]"
                          >
                            <div className="flex-1 min-w-0">
                              <p className="text-sm truncate">{tx.description}</p>
                              <p className="text-xs text-muted-foreground">{tx.date}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={cn(
                                "text-sm font-medium tabular-nums",
                                tx.isExpense ? "text-destructive" : "text-success"
                              )}>
                                {tx.isExpense ? '-' : '+'}{formatCurrency(tx.amount)}
                              </span>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingTransaction(tx.id);
                                }}
                              >
                                <Edit2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CollapsibleContent>
                  </Collapsible>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {step === 'importing' && (
          <div className="p-8 flex flex-col items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground mb-2">
              {t('smartImport.importing')}
            </p>
            <p className="text-lg font-medium">
              {importProgress.current} / {importProgress.total}
            </p>
          </div>
        )}

        {step === 'success' && (
          <div className="p-8 flex flex-col items-center justify-center text-center">
            <div className="h-16 w-16 rounded-full bg-success/20 flex items-center justify-center mb-4">
              <Check className="h-8 w-8 text-success" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t('smartImport.successTitle')}</h3>
            <p className="text-sm text-muted-foreground mb-4">
              {t('smartImport.successMessage', { count: parsedTransactions.length })}
            </p>
            <div className="flex items-center gap-2 text-primary">
              <Sparkles className="h-4 w-4" />
              <span className="text-sm">{t('smartImport.learningMessage')}</span>
            </div>
          </div>
        )}

        <ResponsiveDialogFooter>
          {step === 'upload' && (
            <Button variant="outline" onClick={handleClose} className="min-h-[44px]">
              {t('common.cancel')}
            </Button>
          )}
          {step === 'review' && (
            <>
              <Button
                variant="outline"
                onClick={() => { setStep('upload'); setParsedTransactions([]); }}
                className="min-h-[44px]"
              >
                {t('common.back')}
              </Button>
              <Button
                onClick={handleConfirmAll}
                className="min-h-[44px]"
              >
                <Check className="h-4 w-4 mr-2" />
                {t('smartImport.confirmAll')} ({parsedTransactions.length})
              </Button>
            </>
          )}
          {step === 'success' && (
            <Button onClick={handleClose} className="min-h-[44px]">
              {t('common.close')}
            </Button>
          )}
        </ResponsiveDialogFooter>

        {/* Category Selector Bottom Sheet */}
        {editingTransaction && (
          <CategorySelector
            open={!!editingTransaction}
            onOpenChange={(open) => !open && setEditingTransaction(null)}
            categories={activeCategories}
            onSelect={(categoryId) => updateTransactionCategory(editingTransaction, categoryId)}
          />
        )}
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
