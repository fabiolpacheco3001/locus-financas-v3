import * as React from "react";
import { cn } from "@/lib/utils";

interface MoneyInputProps extends Omit<React.ComponentProps<"input">, "onChange" | "value" | "type"> {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
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
 * Parses a display string (with comma or dot as decimal) to number
 */
function parseToNumber(str: string): number | undefined {
  if (!str.trim()) return undefined;
  
  // Remove thousand separators (dots used in pt-BR formatting)
  // Then replace comma with dot for decimal
  const cleaned = str
    .replace(/\s/g, "")
    .replace(/\./g, "") // remove thousand separators
    .replace(",", "."); // decimal separator
  
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? undefined : Math.round(parsed * 100) / 100;
}

const MoneyInput = React.forwardRef<HTMLInputElement, MoneyInputProps>(
  ({ className, value, onChange, placeholder = "0,00", onBlur, ...props }, ref) => {
    // Track the raw string during editing
    const [displayValue, setDisplayValue] = React.useState<string>(() => 
      value !== undefined && value !== 0 ? formatToBRL(value) : ""
    );
    const [isEditing, setIsEditing] = React.useState(false);

    // Sync display value when external value changes and not editing
    React.useEffect(() => {
      if (!isEditing) {
        setDisplayValue(value !== undefined && value !== 0 ? formatToBRL(value) : "");
      }
    }, [value, isEditing]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      
      // Allow only digits, comma, and dot - no formatting during typing
      const sanitized = raw.replace(/[^\d,\.]/g, "");
      
      setDisplayValue(sanitized);
      
      // Parse and notify parent immediately (for validation purposes)
      // But don't format - just parse the raw value
      const numValue = parseToNumber(sanitized);
      onChange(numValue);
    };

    const handleFocus = () => {
      setIsEditing(true);
      // On focus, show raw value without thousand separators for easier editing
      if (value !== undefined && value !== 0) {
        // Convert to simple format: "1234,56" instead of "1.234,56"
        setDisplayValue(value.toFixed(2).replace(".", ","));
      }
    };

    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      setIsEditing(false);
      
      // Parse the current display value
      const numValue = parseToNumber(displayValue);
      
      // Format for display
      if (numValue !== undefined && numValue !== 0) {
        setDisplayValue(formatToBRL(numValue));
      } else {
        setDisplayValue("");
      }
      
      // Update parent with final parsed value
      onChange(numValue);
      
      onBlur?.(e);
    };

    return (
      <input
        type="text"
        inputMode="decimal"
        className={cn(
          "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        {...props}
      />
    );
  },
);
MoneyInput.displayName = "MoneyInput";

export { MoneyInput };
