import { motion } from 'framer-motion';
import { LucideIcon, Info } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GlassStatCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: 'up' | 'down' | 'neutral';
  trendLabel?: string;
  delay?: number;
  colorScheme?: 'success' | 'destructive' | 'warning' | 'primary' | 'muted';
  tooltip?: string;
  compact?: boolean;
}

const colorSchemes = {
  success: {
    icon: 'bg-success/20 text-success',
    value: 'text-success',
    glow: 'shadow-glow-success',
  },
  destructive: {
    icon: 'bg-destructive/20 text-destructive',
    value: 'text-destructive',
    glow: 'shadow-glow-destructive',
  },
  warning: {
    icon: 'bg-warning/20 text-warning',
    value: 'text-warning',
    glow: '',
  },
  primary: {
    icon: 'bg-primary/20 text-primary',
    value: 'text-primary',
    glow: 'shadow-glow-primary',
  },
  muted: {
    icon: 'bg-muted text-muted-foreground',
    value: 'text-foreground',
    glow: '',
  },
};

export function GlassStatCard({
  title,
  value,
  icon: Icon,
  trend,
  trendLabel,
  delay = 0,
  colorScheme = 'primary',
  tooltip,
  compact = false,
}: GlassStatCardProps) {
  const scheme = colorSchemes[colorScheme];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ 
        duration: 0.4, 
        delay,
        ease: [0.25, 0.46, 0.45, 0.94]
      }}
      whileHover={{ scale: 1.02, transition: { duration: 0.2 } }}
      className={cn(
        "relative overflow-hidden rounded-xl border border-border/50 bg-card/80 backdrop-blur-md shadow-lg h-full",
        "hover:border-primary/30 transition-colors duration-300",
        compact ? "p-3" : "p-4"
      )}
    >
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-primary/5 pointer-events-none" />
      
      <div className="relative flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 mb-1">
            <p className={cn(
              "font-medium text-muted-foreground truncate",
              compact ? "text-xs" : "text-sm"
            )}>
              {title}
            </p>
            {tooltip && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-3 w-3 text-muted-foreground/60 cursor-help shrink-0" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-[280px]">
                    <p className="text-sm">{tooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
          <p className={cn("font-bold", scheme.value, compact ? "text-lg" : "text-xl")}>
            {value}
          </p>
          {trendLabel && (
            <p className={cn(
              "mt-0.5",
              compact ? "text-[10px]" : "text-xs",
              trend === 'up' && "text-success",
              trend === 'down' && "text-destructive",
              trend === 'neutral' && "text-muted-foreground"
            )}>
              {trendLabel}
            </p>
          )}
        </div>
        
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
          className={cn(
            "flex items-center justify-center rounded-lg shrink-0",
            scheme.icon,
            compact ? "h-8 w-8" : "h-10 w-10"
          )}
        >
          <Icon className={compact ? "h-4 w-4" : "h-5 w-5"} />
        </motion.div>
      </div>
    </motion.div>
  );
}