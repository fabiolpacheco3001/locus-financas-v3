/**
 * File Drop Zone
 * 
 * Drag-and-drop zone for CSV/OFX file imports.
 * Supports click-to-select and drag-and-drop.
 */

import { useCallback, useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Upload, FileSpreadsheet, FileText, AlertCircle, Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';

interface FileDropZoneProps {
  onFileSelect: (file: File) => void;
  isLoading?: boolean;
  error?: string | null;
  success?: boolean;
  acceptedFormats?: string[];
  disabled?: boolean;
}

export function FileDropZone({
  onFileSelect,
  isLoading = false,
  error = null,
  success = false,
  acceptedFormats = ['.csv', '.ofx', '.qfx', '.txt'],
  disabled = false
}: FileDropZoneProps) {
  const { t } = useTranslation();
  const [isDragOver, setIsDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      setIsDragOver(true);
    }
  }, [disabled]);
  
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);
  
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    
    if (disabled) return;
    
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [disabled, onFileSelect]);
  
  const handleClick = useCallback(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.click();
    }
  }, [disabled]);
  
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      const file = files[0];
      setSelectedFile(file);
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  const getFileIcon = (filename: string) => {
    const ext = filename.toLowerCase().split('.').pop();
    if (ext === 'csv' || ext === 'txt') {
      return <FileSpreadsheet className="h-8 w-8 text-success" />;
    }
    return <FileText className="h-8 w-8 text-primary" />;
  };
  
  return (
    <div className="space-y-4">
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          "relative border-2 border-dashed rounded-lg p-8 text-center transition-all cursor-pointer",
          "hover:border-primary/50 hover:bg-primary/5",
          isDragOver && "border-primary bg-primary/10 scale-[1.02]",
          error && "border-destructive bg-destructive/5",
          success && "border-success bg-success/5",
          disabled && "opacity-50 cursor-not-allowed"
        )}
        data-testid="file-drop-zone"
      >
        <input
          ref={inputRef}
          type="file"
          accept={acceptedFormats.join(',')}
          onChange={handleFileChange}
          className="hidden"
          disabled={disabled}
          data-testid="file-input"
        />
        
        {isLoading ? (
          <div className="space-y-4">
            <div className="animate-pulse flex justify-center">
              <Upload className="h-12 w-12 text-primary" />
            </div>
            <Progress value={undefined} className="w-48 mx-auto" />
            <p className="text-sm text-muted-foreground">
              {t('fileImport.processing', 'Processando arquivo...')}
            </p>
          </div>
        ) : success ? (
          <div className="space-y-2">
            <div className="flex justify-center">
              <Check className="h-12 w-12 text-success" />
            </div>
            <p className="text-sm font-medium text-success">
              {t('fileImport.success', 'Arquivo processado com sucesso!')}
            </p>
            {selectedFile && (
              <p className="text-xs text-muted-foreground">{selectedFile.name}</p>
            )}
          </div>
        ) : error ? (
          <div className="space-y-2">
            <div className="flex justify-center">
              <AlertCircle className="h-12 w-12 text-destructive" />
            </div>
            <p className="text-sm font-medium text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={handleClick}>
              {t('fileImport.tryAgain', 'Tentar novamente')}
            </Button>
          </div>
        ) : (
          <>
            {selectedFile ? (
              <div className="space-y-2">
                <div className="flex justify-center">
                  {getFileIcon(selectedFile.name)}
                </div>
                <p className="text-sm font-medium">{selectedFile.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(selectedFile.size / 1024).toFixed(1)} KB
                </p>
              </div>
            ) : (
              <>
                <div className="flex justify-center mb-4">
                  <Upload className={cn(
                    "h-12 w-12 transition-colors",
                    isDragOver ? "text-primary" : "text-muted-foreground"
                  )} />
                </div>
                <p className="text-sm font-medium mb-1">
                  {t('fileImport.dropHere', 'Arraste um arquivo aqui')}
                </p>
                <p className="text-xs text-muted-foreground mb-3">
                  {t('fileImport.orClick', 'ou clique para selecionar')}
                </p>
                <div className="flex justify-center gap-2 flex-wrap">
                  {acceptedFormats.map(fmt => (
                    <span 
                      key={fmt}
                      className="px-2 py-1 text-xs rounded-full bg-muted text-muted-foreground"
                    >
                      {fmt.toUpperCase().replace('.', '')}
                    </span>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
