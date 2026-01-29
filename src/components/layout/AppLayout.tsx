import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  ArrowLeftRight, 
  Wallet, 
  Tags, 
  Users, 
  LogOut,
  X,
  Bell,
  CreditCard,
  PiggyBank,
  Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { useLocale } from '@/i18n/useLocale';
import { LanguageSelector } from '@/components/settings/LanguageSelector';
import { XpProgressBar } from '@/components/gamification/XpProgressBar';
import { ThemeToggle } from '@/components/theme/ThemeToggle';
import { BottomNavigationBar } from './BottomNavigationBar';
import locusLogo from '@/assets/locus-logo.svg';


interface NavItem {
  labelKey: string;
  href: string;
  icon: React.ElementType;
}

const navItems: NavItem[] = [
  { labelKey: 'nav.dashboard', href: '/', icon: LayoutDashboard },
  { labelKey: 'nav.transactions', href: '/transactions', icon: ArrowLeftRight },
  { labelKey: 'nav.budget', href: '/budget', icon: PiggyBank },
  { labelKey: 'nav.accounts', href: '/accounts', icon: Wallet },
  { labelKey: 'nav.creditCards', href: '/credit-cards', icon: CreditCard },
  { labelKey: 'nav.categories', href: '/categories', icon: Tags },
  { labelKey: 'nav.members', href: '/members', icon: Users },
  { labelKey: 'nav.notifications', href: '/notifications', icon: Bell },
  { labelKey: 'nav.settings', href: '/settings', icon: Settings },
];

interface AppLayoutProps {
  children: React.ReactNode;
  onMobileAddClick?: () => void;
}

export function AppLayout({ children, onMobileAddClick }: AppLayoutProps) {
  const { t } = useLocale();
  const { member, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  // Default add click handler - navigate to transactions with intent
  const handleMobileAdd = onMobileAddClick || (() => {
    navigate('/transactions?action=new');
  });

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <div className="min-h-screen bg-background pb-20 lg:pb-0 overflow-x-hidden">
      {/* Mobile Menu Overlay - Slides from bottom */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 z-[60] lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" />
          
          {/* Menu Panel */}
          <div 
            className="absolute bottom-0 left-0 right-0 bg-card border-t border-border rounded-t-3xl shadow-2xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Handle */}
            <div className="flex justify-center py-3">
              <div className="w-12 h-1 rounded-full bg-muted" />
            </div>
            
            {/* Header */}
            <div className="flex items-center justify-between px-6 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white p-1.5 shadow-md">
                  <img src={locusLogo} alt="Locus" className="h-full w-full object-contain" />
                </div>
                <div>
                  <p className="font-medium text-foreground">{member?.name}</p>
                  <p className="text-xs text-muted-foreground">Locus Finanças</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setMobileMenuOpen(false)}>
                <X className="h-5 w-5" />
              </Button>
            </div>
            
            {/* Navigation Grid */}
            <nav className="p-4 grid grid-cols-4 gap-3 max-h-[50vh] overflow-y-auto no-scrollbar">
              {navItems.map((item) => {
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
                      isActive 
                        ? "bg-primary/10 text-primary" 
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-6 w-6" />
                    <span className="text-[10px] font-medium text-center leading-tight">{t(item.labelKey)}</span>
                  </Link>
                );
              })}
            </nav>
            
            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-border space-y-3">
              <div className="flex items-center justify-between">
                <LanguageSelector showLabel={false} />
                <div className="flex items-center gap-2">
                  <ThemeToggle />
                  <NotificationBell />
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSignOut}
                className="w-full justify-center gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
                {t('common.signOut')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Header - Minimal */}
      <header className="sticky top-0 z-50 border-b border-border/50 bg-card/80 backdrop-blur-xl lg:hidden">
        <div className="flex h-14 items-center justify-between px-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white p-1.5 shadow-md">
              <img src={locusLogo} alt="Locus Finanças" className="h-full w-full object-contain" />
            </div>
            <span className="font-semibold text-foreground">Locus</span>
          </Link>
          <div className="flex items-center gap-1">
            {/* XP bar hidden for MVP - gamification disabled */}
            <NotificationBell />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar - Fixed with proper sticky footer */}
        <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 border-r border-border bg-card lg:flex lg:flex-col">
          {/* Header */}
          <div className="flex h-16 items-center justify-between border-b border-border px-6 shrink-0">
            <Link to="/" className="flex items-center gap-2">
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white p-2 shadow-md">
                <img src={locusLogo} alt="Locus Finanças" className="h-full w-full object-contain" />
              </div>
            </Link>
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <NotificationBell />
            </div>
          </div>
          
          {/* Scrollable Navigation */}
          <nav className="flex-1 overflow-y-auto p-4 no-scrollbar">
            <ul className="space-y-1">
              {navItems.map((item) => (
                <li key={item.href}>
                  <Link
                    to={item.href}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                      location.pathname === item.href
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-5 w-5" />
                    {t(item.labelKey)}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* XP Bar - Hidden for MVP (gamification disabled) */}
          {/* <div className="px-4 pb-2 shrink-0">
            <XpProgressBar variant="full" />
          </div> */}

          {/* Sticky Footer - User & Logout */}
          <div className="border-t border-border p-4 space-y-3 shrink-0 bg-card">
            <div className="px-3 text-sm font-medium text-foreground truncate">
              {member?.name}
            </div>
            <LanguageSelector showLabel={false} className="px-3" />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="w-full justify-start gap-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
              {t('common.signOut')}
            </Button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 lg:ml-64 overflow-x-hidden">
          <div className="container py-6 max-w-full overflow-x-hidden">
            {children}
          </div>
        </main>
      </div>
      
      {/* Mobile Bottom Navigation */}
      <BottomNavigationBar 
        onAddClick={handleMobileAdd} 
        onMenuClick={handleMobileMenuToggle}
      />
    </div>
  );
}
