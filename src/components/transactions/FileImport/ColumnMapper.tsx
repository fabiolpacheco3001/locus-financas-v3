/**
 * Column Mapper
 * 
 * UI to map file columns to Locus internal schema.
 * Shows preview of first few rows to help with mapping.
 */

import { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ColumnMapping, RawTransactionData } from '@/domain/transactions/types';

interface ColumnMapperProps {
  headers: string[];
  previewData?: RawTransactionData[];
  onConfirm: (mapping: ColumnMapping) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

const REQUIRED_FIELDS = ['date', 'description', 'amount'] as const;
const OPTIONAL_FIELDS = ['type', 'category'] as const;

export function ColumnMapper({
  headers,
  previewData = [],
  onConfirm,
  onCancel,
  isLoading = false
}: ColumnMapperProps) {
  const { t } = useTranslation();
  
  // Auto-detect initial mappings
  const initialMapping = useMemo(() => {
    const mapping: Partial<ColumnMapping> = {};
    
    headers.forEach(header => {
      const lower = header.toLowerCase().trim();
      
      // Date detection
      if (!mapping.date && (
        lower.includes('data') || 
        lower.includes('date') || 
        lower === 'dt' ||
        lower.includes('lancamento') ||
        lower.includes('lançamento')
      )) {
        mapping.date = header;
      }
      
      // Description detection
      if (!mapping.description && (
        lower.includes('descri') ||
        lower.includes('histor') ||
        lower.includes('memo') ||
        lower.includes('name') ||
        lower.includes('titulo') ||
        lower.includes('título')
      )) {
        mapping.description = header;
      }
      
      // Amount detection
      if (!mapping.amount && (
        lower.includes('valor') ||
        lower.includes('amount') ||
        lower.includes('value') ||
        lower === 'vl' ||
        lower.includes('quantia')
      )) {
        mapping.amount = header;
      }
      
      // Type detection (optional)
      if (!mapping.type && (
        lower.includes('tipo') ||
        lower.includes('type') ||
        lower.includes('natureza') ||
        lower === 'c/d' ||
        lower === 'd/c'
      )) {
        mapping.type = header;
      }
      
      // Category detection (optional)
      if (!mapping.category && (
        lower.includes('categoria') ||
        lower.includes('category') ||
        lower.includes('class')
      )) {
        mapping.category = header;
      }
    });
    
    return mapping;
  }, [headers]);
  
  const [mapping, setMapping] = useState<Partial<ColumnMapping>>(initialMapping);
  
  const isComplete = REQUIRED_FIELDS.every(field => mapping[field]);
  
  const handleFieldChange = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({
      ...prev,
      [field]: value === '__none__' ? undefined : value
    }));
  };
  
  const handleConfirm = () => {
    if (isComplete) {
      onConfirm(mapping as ColumnMapping);
    }
  };
  
  const getFieldLabel = (field: string) => {
    const labels: Record<string, string> = {
      date: t('fileImport.mapping.date', 'Data'),
      description: t('fileImport.mapping.description', 'Descrição'),
      amount: t('fileImport.mapping.amount', 'Valor'),
      type: t('fileImport.mapping.type', 'Tipo (C/D)'),
      category: t('fileImport.mapping.category', 'Categoria')
    };
    return labels[field] || field;
  };
  
  return (
    <div className="space-y-6" data-testid="column-mapper">
      <div>
        <h3 className="text-lg font-semibold mb-2">
          {t('fileImport.mapping.title', 'Mapear colunas')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('fileImport.mapping.subtitle', 'Associe as colunas do arquivo aos campos do Locus')}
        </p>
      </div>
      
      {/* Required Fields */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="default">
            {t('fileImport.mapping.required', 'Obrigatórios')}
          </Badge>
        </div>
        
        <div className="grid gap-4">
          {REQUIRED_FIELDS.map(field => (
            <div key={field} className="flex items-center gap-4">
              <div className="w-32">
                <Label className="flex items-center gap-2">
                  {mapping[field] ? (
                    <Check className="h-4 w-4 text-success" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 text-warning" />
                  )}
                  {getFieldLabel(field)}
                </Label>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select
                value={mapping[field] || ''}
                onValueChange={(value) => handleFieldChange(field, value)}
              >
                <SelectTrigger 
                  className="flex-1"
                  data-testid={`mapping-${field}`}
                >
                  <SelectValue placeholder={t('fileImport.mapping.selectColumn', 'Selecione coluna')} />
                </SelectTrigger>
                <SelectContent>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      
      {/* Optional Fields */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">
            {t('fileImport.mapping.optional', 'Opcionais')}
          </Badge>
        </div>
        
        <div className="grid gap-4">
          {OPTIONAL_FIELDS.map(field => (
            <div key={field} className="flex items-center gap-4">
              <div className="w-32">
                <Label className="text-muted-foreground">
                  {getFieldLabel(field)}
                </Label>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <Select
                value={mapping[field] || '__none__'}
                onValueChange={(value) => handleFieldChange(field, value)}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">
                    {t('fileImport.mapping.ignore', 'Ignorar')}
                  </SelectItem>
                  {headers.map(header => (
                    <SelectItem key={header} value={header}>
                      {header}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>
      
      {/* Preview */}
      {previewData.length > 0 && (
        <div className="space-y-2">
          <Label className="text-sm text-muted-foreground">
            {t('fileImport.mapping.preview', 'Prévia das primeiras transações')}
          </Label>
          <ScrollArea className="h-32 border rounded-md">
            <div className="p-3 space-y-2 text-sm">
              {previewData.slice(0, 3).map((tx, i) => (
                <div key={i} className="flex justify-between items-center py-1 border-b last:border-0">
                  <span className="text-muted-foreground">{tx.date}</span>
                  <span className="flex-1 px-2 truncate">{tx.description}</span>
                  <span className={tx.amount < 0 ? 'text-destructive' : 'text-success'}>
                    {tx.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {/* Actions */}
      <div className="flex justify-end gap-3 pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          {t('common.cancel', 'Cancelar')}
        </Button>
        <Button 
          onClick={handleConfirm}
          disabled={!isComplete || isLoading}
          data-testid="confirm-mapping"
        >
          {t('fileImport.mapping.confirm', 'Confirmar e importar')}
        </Button>
      </div>
    </div>
  );
}
