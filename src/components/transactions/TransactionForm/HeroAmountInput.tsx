import * as React from "react";
import { cn } from "@/lib/utils";

interface HeroAmountInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  currencySymbol?: string;
}

/**
 * Formats a number to Brazilian currency display format (1.234,56)
 */
function formatToBRL(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Parses a display string (with comma or dot as decimal) to number.
 * Handles both pt-BR (1.234,56) and en-US (1,234.56) formats.
 */
function parseToNumber(str: string): number | undefined {
  if (!str.trim()) return undefined;
  
  // Detect format: if comma appears after the last dot, it's pt-BR (comma is decimal)
  // If dot appears after the last comma, it's en-US (dot is decimal)
  const lastComma = str.lastIndexOf(',');
  const lastDot = str.lastIndexOf('.');
  
  let cleaned: string;
  
  if (lastComma > lastDot) {
    // pt-BR format: dots are thousand separators, comma is decimal
    cleaned = str.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  } else if (lastDot > lastComma) {
    // en-US format: commas are thousand separators, dot is decimal
    cleaned = str.replace(/\s/g, "").replace(/,/g, "");
  } else {
    // Only one or none separators - treat as simple number
    cleaned = str.replace(/\s/g, "").replace(",", ".");
  }
  
  const parsed = parseFloat(cleaned);
  
  // Guard: Return undefined if NaN or negative
  if (isNaN(parsed) || parsed < 0) return undefined;
  
  // Round to 2 decimal places
  return Math.round(parsed * 100) / 100;
}

/**
 * Validates that the amount is valid for submission (positive number)
 */
export function isValidAmount(value: number | undefined): boolean {
  return value !== undefined && !isNaN(value) && value > 0;
}

const HeroAmountInput = React.forwardRef<HTMLInputElement, HeroAmountInputProps>(
  ({ className, value, onChange, currencySymbol = "R$", placeholder = "0,00", onBlur, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState<string>(() => 
      typeof value === 'number' && !isNaN(value) && value !== 0 ? formatToBRL(value) : ""
    );
    const [isEditing, setIsEditing] = React.useState(false);

    React.useEffect(() => {
      if (!isEditing) {
        if (typeof value === 'number' && !isNaN(value)) {
          setDisplayValue(value !== 0 ? formatToBRL(value) : "");
        } else {
          setDisplayValue("");
        }
      }
    }, [value, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      const sanitized = raw.replace(/[^\d,\.]/g, "");
      setDisplayValue(sanitized);
      const numValue = parseToNumber(sanitized);
      onChange(numValue);
    };

    const handleFocus = () => {
      setIsEditing(true);
      if (typeof value === 'number' && !isNaN(value) && value !== 0) {
        setDisplayValue(value.toFixed(2).replace(".", ","));
      } else {
        setDisplayValue("");
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(false);
      const numValue = parseToNumber(displayValue);
      if (typeof numValue === 'number' && numValue !== 0) {
        setDisplayValue(formatToBRL(numValue));
      } else {
        setDisplayValue("");
      }
      onChange(numValue);
      onBlur?.(e);
    };

    return (
      <div className="flex items-center justify-center gap-2" data-testid="hero-amount-container">
        <span className="text-2xl md:text-3xl font-medium text-muted-foreground">
          {currencySymbol}
        </span>
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            "w-full bg-transparent border-none outline-none text-4xl md:text-5xl font-bold text-foreground placeholder:text-muted-foreground/40 text-center focus:ring-0",
            className,
          )}
          ref={ref}
          value={displayValue}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          data-testid="form-amount"
          aria-label="Transaction amount"
          {...props}
        />
      </div>
    );
  },
);
HeroAmountInput.displayName = "HeroAmountInput";

export { HeroAmountInput };
