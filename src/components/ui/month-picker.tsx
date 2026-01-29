import { format, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";
import { useLocale } from "@/i18n/useLocale";

interface MonthPickerProps {
  value: Date;
  onChange: (date: Date) => void;
  'data-testid'?: string;
}

export function MonthPicker({ value, onChange, 'data-testid': testId }: MonthPickerProps) {
  const { dateLocale } = useLocale();
  
  return (
    <div className="flex items-center gap-2" data-testid={testId}>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(subMonths(value, 1))}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <div className="min-w-[140px] text-center font-medium capitalize">
        {format(value, "MMMM yyyy", { locale: dateLocale })}
      </div>
      <Button
        variant="outline"
        size="icon"
        onClick={() => onChange(addMonths(value, 1))}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>
    </div>
  );
}
