import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, ArrowLeftRight, Plus, TrendingUp, Menu } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';

interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
  isAction?: boolean;
}

const navItems: NavItem[] = [
  { labelKey: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { labelKey: 'nav.transactions', href: '/transactions', icon: ArrowLeftRight },
  { labelKey: 'nav.add', href: '#add', icon: Plus, isAction: true },
  { labelKey: 'nav.budget', href: '/budget', icon: TrendingUp },
  { labelKey: 'nav.menu', href: '#menu', icon: Menu },
];

interface BottomNavigationBarProps {
  onAddClick?: () => void;
  onMenuClick?: () => void;
}

export function BottomNavigationBar({ onAddClick, onMenuClick }: BottomNavigationBarProps) {
  const { t } = useLocale();
  const location = useLocation();

  return (
    <nav 
      className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border/50 lg:hidden"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      data-testid="bottom-navigation"
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = !item.isAction && item.href !== '#menu' && location.pathname === item.href;
          const Icon = item.icon;

          // Floating Action Button (Center)
          if (item.isAction) {
            return (
              <button
                key={item.href}
                onClick={onAddClick}
                className="flex flex-col items-center justify-center -mt-6"
                data-testid="btn-add-transaction-mobile"
              >
                <div className="flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/40 hover:shadow-primary/60 active:scale-95 transition-all duration-200">
                  <Icon className="h-6 w-6" />
                </div>
              </button>
            );
          }

          // Menu button
          if (item.href === '#menu') {
            return (
              <button
                key={item.href}
                onClick={onMenuClick}
                className={cn(
                  "flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className="h-5 w-5" />
                <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              to={item.href}
              className={cn(
                "flex flex-col items-center justify-center min-w-[56px] min-h-[44px] gap-0.5 transition-colors",
                isActive 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <Icon className={cn("h-5 w-5", isActive && "drop-shadow-[0_0_8px_hsl(var(--primary))]")} />
              <span className="text-[10px] font-medium">{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
