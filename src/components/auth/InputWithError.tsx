import { Input } from '@/components/ui/input';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface InputWithErrorProps {
  id: string;
  type: string;
  placeholder: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  error?: string;
  showError: boolean;
  className?: string;
  'data-testid'?: string;
}

export function InputWithError({
  id,
  type,
  placeholder,
  value,
  onChange,
  onBlur,
  error,
  showError,
  className,
  'data-testid': testId,
}: InputWithErrorProps) {
  return (
    <div className="relative">
      <Input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        data-testid={testId}
        className={cn(
          className,
          showError && "border-destructive focus-visible:ring-destructive"
        )}
      />
      {showError && (
        <div className="flex items-center gap-1 mt-1 text-destructive text-sm" data-testid={`${id}-error`}>
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
