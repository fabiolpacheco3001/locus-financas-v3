import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, Info } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface HeroBalanceProps {
  memberName?: string;
  balance: number;
  trend?: 'up' | 'down' | 'neutral';
  subtitle?: string;
  tooltip?: string;
  label?: string;
}

export function HeroBalance({ memberName, balance, trend, subtitle, tooltip, label }: HeroBalanceProps) {
  const { t, formatCurrency } = useLocale();
  
  // Get greeting based on time of day
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return t('dashboard.greeting.morning');
    if (hour < 18) return t('dashboard.greeting.afternoon');
    return t('dashboard.greeting.evening');
  };

  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : Minus;

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      className="mb-4"
    >
      <p className="text-base text-muted-foreground mb-0.5">
        {getGreeting()}{memberName ? `, ${memberName}` : ''}
      </p>
      
      <div className="flex items-center gap-3">
        <h1 
          className={cn(
            "text-3xl sm:text-4xl font-bold tracking-tight",
            balance >= 0 ? "text-foreground" : "text-destructive"
          )}
        >
          {formatCurrency(balance)}
        </h1>
        
        {trend && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.3, type: 'spring', stiffness: 200 }}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-full",
              trend === 'up' && "bg-success/20 text-success",
              trend === 'down' && "bg-destructive/20 text-destructive",
              trend === 'neutral' && "bg-muted text-muted-foreground"
            )}
          >
            <TrendIcon className="h-4 w-4" />
          </motion.div>
        )}
        
        {tooltip && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="h-4 w-4 text-muted-foreground/60 cursor-help" />
              </TooltipTrigger>
              <TooltipContent className="max-w-[280px]">
                <p className="text-sm">{tooltip}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>
      
      {(subtitle || label) && (
        <p className="text-xs text-muted-foreground mt-1">
          {label && <span className="font-medium">{label}: </span>}
          {subtitle}
        </p>
      )}
    </motion.div>
  );
}