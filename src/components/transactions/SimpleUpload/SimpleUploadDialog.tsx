import { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import Papa from 'papaparse';
import { format } from 'date-fns';
import { Upload, FileSpreadsheet, Check, X, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from '@/components/ui/responsive-dialog';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface ParsedTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  selected: boolean;
  isValid: boolean;
  error?: string;
}

interface SimpleUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImport: (transactions: Array<{ date: string; description: string; amount: number }>) => Promise<void>;
}

export function SimpleUploadDialog({ open, onOpenChange, onImport }: SimpleUploadDialogProps) {
  const { t, formatCurrency } = useLocale();
  const [step, setStep] = useState<'upload' | 'review' | 'importing'>('upload');
  const [parsedTransactions, setParsedTransactions] = useState<ParsedTransaction[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  const parseFile = useCallback((file: File) => {
    setError(null);
    setFileName(file.name);

    const isOFX = file.name.toLowerCase().endsWith('.ofx');

    if (isOFX) {
      // Simple OFX parsing
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const transactions: ParsedTransaction[] = [];
          
          // Extract transactions from OFX using regex
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
                selected: true,
                isValid: !isNaN(amount) && date.length === 10,
              });
            }
          }
          
          if (transactions.length === 0) {
            setError(t('fileImport.noTransactionsFound'));
          } else {
            setParsedTransactions(transactions);
            setStep('review');
          }
        } catch (err) {
          setError(t('fileImport.parseError'));
        }
      };
      reader.readAsText(file);
    } else {
      // CSV parsing
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          if (results.errors.length > 0) {
            setError(t('fileImport.parseError'));
            return;
          }

          const transactions: ParsedTransaction[] = results.data.map((row: any, index) => {
            // Try to detect columns
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

            // Parse date (try multiple formats)
            let parsedDate = '';
            if (rawDate) {
              // DD/MM/YYYY format
              const match1 = rawDate.match(/(\d{2})\/(\d{2})\/(\d{4})/);
              if (match1) {
                parsedDate = `${match1[3]}-${match1[2]}-${match1[1]}`;
              }
              // YYYY-MM-DD format
              const match2 = rawDate.match(/(\d{4})-(\d{2})-(\d{2})/);
              if (match2) {
                parsedDate = rawDate;
              }
            }

            // Parse amount
            const cleanAmount = String(rawAmount)
              .replace(/[R$\s]/g, '')
              .replace(/\./g, '')
              .replace(',', '.');
            const amount = parseFloat(cleanAmount);

            const isValid = parsedDate.length === 10 && !isNaN(amount);

            return {
              id: `tx-${index}`,
              date: parsedDate || format(new Date(), 'yyyy-MM-dd'),
              description: String(description).trim(),
              amount: Math.abs(amount) || 0,
              selected: isValid,
              isValid,
              error: !isValid ? t('fileImport.invalidRow') : undefined,
            };
          });

          if (transactions.length === 0) {
            setError(t('fileImport.noTransactionsFound'));
          } else {
            setParsedTransactions(transactions);
            setStep('review');
          }
        },
        error: () => {
          setError(t('fileImport.parseError'));
        },
      });
    }
  }, [t]);

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

  const toggleTransaction = (id: string) => {
    setParsedTransactions(prev =>
      prev.map(tx => tx.id === id ? { ...tx, selected: !tx.selected } : tx)
    );
  };

  const toggleAll = () => {
    const allSelected = parsedTransactions.every(tx => tx.selected);
    setParsedTransactions(prev => prev.map(tx => ({ ...tx, selected: !allSelected })));
  };

  const selectedCount = parsedTransactions.filter(tx => tx.selected && tx.isValid).length;
  const totalAmount = parsedTransactions
    .filter(tx => tx.selected && tx.isValid)
    .reduce((sum, tx) => sum + tx.amount, 0);

  const handleImport = async () => {
    setStep('importing');
    try {
      const toImport = parsedTransactions
        .filter(tx => tx.selected && tx.isValid)
        .map(tx => ({
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
        }));
      
      await onImport(toImport);
      onOpenChange(false);
      setStep('upload');
      setParsedTransactions([]);
    } catch (err) {
      setError(t('fileImport.importError'));
      setStep('review');
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setStep('upload');
    setParsedTransactions([]);
    setError(null);
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={handleClose}>
      <ResponsiveDialogContent className="sm:max-w-lg">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            {t('fileImport.title')}
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription>
            {step === 'upload' && t('fileImport.description')}
            {step === 'review' && t('fileImport.reviewDescription')}
            {step === 'importing' && t('fileImport.importing')}
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
              <p className="text-sm font-medium">{t('fileImport.dropzone')}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t('fileImport.supportedFormats')}
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
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Badge variant="secondary">{fileName}</Badge>
                <span className="text-sm text-muted-foreground">
                  {selectedCount} / {parsedTransactions.length} {t('fileImport.selected')}
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={toggleAll}>
                {parsedTransactions.every(tx => tx.selected)
                  ? t('fileImport.deselectAll')
                  : t('fileImport.selectAll')}
              </Button>
            </div>

            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {parsedTransactions.map((tx) => (
                  <div
                    key={tx.id}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg transition-colors min-h-[52px]",
                      tx.selected && tx.isValid
                        ? "bg-primary/5 border border-primary/20"
                        : "bg-muted/30 border border-transparent",
                      !tx.isValid && "opacity-50"
                    )}
                  >
                    <Checkbox
                      checked={tx.selected}
                      disabled={!tx.isValid}
                      onCheckedChange={() => toggleTransaction(tx.id)}
                      className="min-w-[20px] min-h-[20px]"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{tx.description}</p>
                      <p className="text-xs text-muted-foreground">
                        {tx.date} {tx.error && <span className="text-destructive">• {tx.error}</span>}
                      </p>
                    </div>
                    <span className={cn(
                      "text-sm font-medium tabular-nums",
                      tx.amount >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {formatCurrency(tx.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <span className="text-sm font-medium">{t('fileImport.total')}</span>
              <span className="text-lg font-bold">{formatCurrency(totalAmount)}</span>
            </div>

            {error && (
              <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg flex items-center gap-2 text-destructive text-sm">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                {error}
              </div>
            )}
          </div>
        )}

        {step === 'importing' && (
          <div className="p-8 flex flex-col items-center justify-center">
            <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">{t('fileImport.importing')}...</p>
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
                onClick={handleImport}
                disabled={selectedCount === 0}
                className="min-h-[44px]"
              >
                <Check className="h-4 w-4 mr-2" />
                {t('fileImport.importSelected')} ({selectedCount})
              </Button>
            </>
          )}
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
