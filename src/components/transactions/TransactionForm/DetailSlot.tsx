import { cn } from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { ReactNode } from "react";

interface DetailSlotProps {
  icon: ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
  disabled?: boolean;
  className?: string;
  "data-testid"?: string;
}

export function DetailSlot({ 
  icon, 
  label, 
  value, 
  onClick, 
  disabled,
  className,
  "data-testid": testId,
}: DetailSlotProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg bg-background hover:bg-muted/50 transition-colors text-left w-full min-h-[60px]",
        disabled && "opacity-50 cursor-not-allowed",
        className
      )}
      data-testid={testId}
    >
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
      {!disabled && (
        <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
      )}
    </button>
  );
}
