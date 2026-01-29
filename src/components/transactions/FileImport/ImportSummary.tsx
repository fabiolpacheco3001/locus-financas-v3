/**
 * Import Summary
 * 
 * Shows results after file import with counts and any errors.
 */

import { useTranslation } from 'react-i18next';
import { Check, X, AlertTriangle, FileSpreadsheet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ImportResult } from '@/domain/transactions/types';

interface ImportSummaryProps {
  result: ImportResult;
  onClose: () => void;
  onImportMore: () => void;
}

export function ImportSummary({ result, onClose, onImportMore }: ImportSummaryProps) {
  const { t } = useTranslation();
  
  return (
    <div className="space-y-6" data-testid="import-summary">
      {/* Header */}
      <div className="text-center space-y-2">
        {result.success ? (
          <div className="flex justify-center">
            <div className="rounded-full bg-success/10 p-3">
              <Check className="h-8 w-8 text-success" />
            </div>
          </div>
        ) : (
          <div className="flex justify-center">
            <div className="rounded-full bg-warning/10 p-3">
              <AlertTriangle className="h-8 w-8 text-warning" />
            </div>
          </div>
        )}
        
        <h3 className="text-lg font-semibold">
          {result.success 
            ? t('fileImport.summary.successTitle', 'Importação concluída!')
            : t('fileImport.summary.partialTitle', 'Importação com avisos')}
        </h3>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="text-center p-4 rounded-lg bg-success/5 border border-success/20">
          <div className="text-2xl font-bold text-success">{result.imported}</div>
          <div className="text-sm text-muted-foreground">
            {t('fileImport.summary.imported', 'Importadas')}
          </div>
        </div>
        
        <div className="text-center p-4 rounded-lg bg-muted">
          <div className="text-2xl font-bold text-muted-foreground">{result.skipped}</div>
          <div className="text-sm text-muted-foreground">
            {t('fileImport.summary.skipped', 'Ignoradas')}
          </div>
        </div>
        
        <div className="text-center p-4 rounded-lg bg-destructive/5 border border-destructive/20">
          <div className="text-2xl font-bold text-destructive">{result.errors.length}</div>
          <div className="text-sm text-muted-foreground">
            {t('fileImport.summary.errors', 'Erros')}
          </div>
        </div>
      </div>
      
      {/* Errors List */}
      {result.errors.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 text-destructive" />
            <span className="text-sm font-medium">
              {t('fileImport.summary.errorList', 'Detalhes dos erros')}
            </span>
          </div>
          <ScrollArea className="h-32 border rounded-md">
            <div className="p-3 space-y-1 text-sm">
              {result.errors.map((error, i) => (
                <div key={i} className="flex items-start gap-2 text-destructive">
                  <span className="text-muted-foreground">•</span>
                  {error}
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex justify-center gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onImportMore}>
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          {t('fileImport.summary.importMore', 'Importar outro arquivo')}
        </Button>
        <Button onClick={onClose}>
          {t('common.close', 'Fechar')}
        </Button>
      </div>
    </div>
  );
}
