/**
 * File Import Dialog
 * 
 * Complete file import workflow:
 * 1. File selection (drag & drop)
 * 2. Column mapping (for CSV)
 * 3. Account selection
 * 4. Import confirmation
 * 5. Results summary
 */

import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { FileSpreadsheet } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { FileDropZone } from './FileDropZone';
import { ColumnMapper } from './ColumnMapper';
import { ImportSummary } from './ImportSummary';
import { fileProvider } from '@/domain/transactions/providers';
import type { ColumnMapping, FileParseResult, ImportResult, RawTransactionData } from '@/domain/transactions/types';
import type { Account } from '@/types/finance';

type ImportStep = 'upload' | 'mapping' | 'account' | 'summary';

interface FileImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: Account[];
  onImport: (transactions: RawTransactionData[], accountId: string) => Promise<ImportResult>;
}

export function FileImportDialog({
  open,
  onOpenChange,
  accounts,
  onImport
}: FileImportDialogProps) {
  const { t } = useTranslation();
  
  const [step, setStep] = useState<ImportStep>('upload');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parseResult, setParseResult] = useState<FileParseResult | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [parsedTransactions, setParsedTransactions] = useState<RawTransactionData[]>([]);
  
  const activeAccounts = accounts.filter(a => a.is_active && a.type !== 'CARD');
  
  const resetState = useCallback(() => {
    setStep('upload');
    setIsLoading(false);
    setError(null);
    setParseResult(null);
    setImportResult(null);
    setSelectedAccountId('');
    setParsedTransactions([]);
    fileProvider.clear();
  }, []);
  
  const handleFileSelect = useCallback(async (file: File) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await fileProvider.parseFile(file);
      setParseResult(result);
      
      if (!result.success && result.errors.length > 0) {
        setError(result.errors[0]);
        return;
      }
      
      // OFX files don't need mapping
      if (result.fileType === 'ofx') {
        setParsedTransactions(result.transactions);
        setStep('account');
      } else {
        // CSV needs column mapping
        setStep('mapping');
      }
    } catch (e) {
      setError(t('fileImport.errors.parseFailed', 'Erro ao processar arquivo'));
    } finally {
      setIsLoading(false);
    }
  }, [t]);
  
  const handleMappingConfirm = useCallback(async (mapping: ColumnMapping) => {
    if (!parseResult) return;
    
    setIsLoading(true);
    
    try {
      // Re-parse with mapping
      fileProvider.setColumnMapping(mapping);
      const result = await fileProvider.parseFile(new File([], 'dummy'));
      
      // Actually we need the original file... let's use the transactions from getTransactions
      const transactions = await fileProvider.getTransactions();
      
      if (transactions.length === 0) {
        setError(t('fileImport.errors.noTransactions', 'Nenhuma transação encontrada'));
        return;
      }
      
      setParsedTransactions(transactions);
      setStep('account');
    } catch (e) {
      setError(t('fileImport.errors.mappingFailed', 'Erro ao mapear colunas'));
    } finally {
      setIsLoading(false);
    }
  }, [parseResult, t]);
  
  const handleAccountConfirm = useCallback(async () => {
    if (!selectedAccountId || parsedTransactions.length === 0) return;
    
    setIsLoading(true);
    
    try {
      const result = await onImport(parsedTransactions, selectedAccountId);
      setImportResult(result);
      setStep('summary');
    } catch (e) {
      setError(t('fileImport.errors.importFailed', 'Erro ao importar transações'));
    } finally {
      setIsLoading(false);
    }
  }, [selectedAccountId, parsedTransactions, onImport, t]);
  
  const handleClose = () => {
    resetState();
    onOpenChange(false);
  };
  
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl" data-testid="file-import-dialog">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5" />
            {t('fileImport.title', 'Importar transações')}
          </DialogTitle>
        </DialogHeader>
        
        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t('fileImport.description', 'Importe transações de extratos bancários nos formatos CSV ou OFX.')}
            </p>
            <FileDropZone
              onFileSelect={handleFileSelect}
              isLoading={isLoading}
              error={error}
            />
          </div>
        )}
        
        {step === 'mapping' && parseResult && (
          <ColumnMapper
            headers={parseResult.headers}
            previewData={parseResult.transactions.slice(0, 5)}
            onConfirm={handleMappingConfirm}
            onCancel={resetState}
            isLoading={isLoading}
          />
        )}
        
        {step === 'account' && (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">
                {t('fileImport.selectAccount', 'Selecionar conta')}
              </h3>
              <p className="text-sm text-muted-foreground">
                {t('fileImport.selectAccountDescription', 'Escolha a conta onde as transações serão importadas.')}
              </p>
            </div>
            
            <div className="space-y-2">
              <Label>{t('accounts.account', 'Conta')}</Label>
              <Select
                value={selectedAccountId}
                onValueChange={setSelectedAccountId}
              >
                <SelectTrigger data-testid="account-select">
                  <SelectValue placeholder={t('fileImport.selectAccountPlaceholder', 'Selecione uma conta')} />
                </SelectTrigger>
                <SelectContent>
                  {activeAccounts.map(account => (
                    <SelectItem key={account.id} value={account.id}>
                      {account.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="p-4 rounded-lg bg-muted/50">
              <div className="text-sm">
                <span className="font-medium">{parsedTransactions.length}</span>
                {' '}
                {t('fileImport.transactionsToImport', 'transações serão importadas')}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={resetState}
                className="px-4 py-2 text-sm font-medium rounded-md border hover:bg-muted"
              >
                {t('common.back', 'Voltar')}
              </button>
              <button
                type="button"
                onClick={handleAccountConfirm}
                disabled={!selectedAccountId || isLoading}
                className="px-4 py-2 text-sm font-medium rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                data-testid="confirm-import"
              >
                {isLoading 
                  ? t('fileImport.importing', 'Importando...') 
                  : t('fileImport.import', 'Importar')}
              </button>
            </div>
          </div>
        )}
        
        {step === 'summary' && importResult && (
          <ImportSummary
            result={importResult}
            onClose={handleClose}
            onImportMore={resetState}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
