import { cn } from "@/lib/utils";
import { LucideIcon, HelpCircle } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface StatCardProps {
  title: string;
  subtitle?: string;
  tooltip?: string;
  value: string;
  icon: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function StatCard({ title, subtitle, tooltip, value, icon: Icon, trend, className }: StatCardProps) {
  return (
    <div className={cn(
      "rounded-lg border border-border bg-card p-6 shadow-sm",
      className
    )}>
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-muted-foreground truncate">{title}</p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/60 cursor-help flex-shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[250px]">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className={cn(
            "mt-1 text-2xl font-bold",
            trend === "up" && "text-emerald-600",
            trend === "down" && "text-destructive",
            trend === "neutral" && "text-foreground"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{subtitle}</p>
          )}
        </div>
        <div className={cn(
          "flex h-12 w-12 items-center justify-center rounded-full flex-shrink-0",
          trend === "up" && "bg-emerald-100 text-emerald-600",
          trend === "down" && "bg-destructive/10 text-destructive",
          trend === "neutral" && "bg-primary/10 text-primary",
          !trend && "bg-muted text-muted-foreground"
        )}>
          <Icon className="h-6 w-6" />
        </div>
      </div>
    </div>
  );
}
