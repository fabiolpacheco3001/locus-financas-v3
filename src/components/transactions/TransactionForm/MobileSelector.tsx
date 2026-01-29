import { useState, ReactNode, useMemo } from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from '@/components/ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Check, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLocale } from '@/i18n/useLocale';

interface SelectorItem {
  id: string;
  name: string;
  icon?: ReactNode;
  badge?: string;
  color?: string;
}

interface MobileSelectorProps {
  items: SelectorItem[];
  value?: string;
  onSelect: (id: string | undefined) => void;
  placeholder: string;
  title: string;
  icon?: ReactNode;
  disabled?: boolean;
  searchPlaceholder?: string;
  emptyMessage?: string;
  'data-testid'?: string;
}

export function MobileSelector({
  items,
  value,
  onSelect,
  placeholder,
  title,
  icon,
  disabled,
  searchPlaceholder,
  emptyMessage,
  'data-testid': dataTestId,
}: MobileSelectorProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const selectedItem = items.find(item => item.id === value);

  // Filter items based on search query
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const query = searchQuery.toLowerCase();
    return items.filter(item => item.name.toLowerCase().includes(query));
  }, [items, searchQuery]);

  // Reset search when closing
  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearchQuery('');
    }
  };

  const handleSelectItem = (itemId: string) => {
    onSelect(itemId === value ? undefined : itemId);
    setOpen(false);
    setSearchQuery('');
  };

  const TriggerButton = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className={cn(
        "w-full justify-between h-auto py-3 px-4",
        "bg-muted/30 hover:bg-muted/50 border-0",
        "rounded-lg transition-colors",
        disabled && "opacity-50 cursor-not-allowed"
      )}
      disabled={disabled}
      data-testid={dataTestId}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        {icon && (
          <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        )}
        <div className="text-left flex-1 min-w-0">
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className={cn(
            "text-sm font-medium truncate",
            !selectedItem && "text-muted-foreground"
          )}>
            {selectedItem?.name || placeholder}
          </p>
        </div>
      </div>
      <ChevronDown className="h-4 w-4 text-muted-foreground flex-shrink-0" />
    </Button>
  );

  const ItemsList = (
    <div className="flex flex-col">
      {/* Search Input */}
      <div className="p-2 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder={searchPlaceholder || t('common.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-10 bg-background"
            autoFocus={!isMobile}
          />
        </div>
      </div>
      
      {/* Items List with Native Buttons */}
      <div 
        className="p-2 grid gap-1 max-h-[300px] overflow-y-auto custom-scrollbar"
        onWheel={(e) => e.stopPropagation()}
        onTouchMove={(e) => e.stopPropagation()}
      >
        {filteredItems.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {emptyMessage || t('common.noResults')}
          </p>
        ) : (
          filteredItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSelectItem(item.id)}
              className={cn(
                "flex w-full items-center gap-3 rounded-md p-2 text-sm text-left transition-colors",
                "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                value === item.id && "bg-accent"
              )}
              data-testid={`selector-option-${item.id}`}
            >
              {item.color && (
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
              )}
              {item.icon && (
                <span className="text-muted-foreground flex-shrink-0">
                  {item.icon}
                </span>
              )}
              <span className="flex-1 truncate">{item.name}</span>
              {item.badge && (
                <Badge variant="outline" className="text-xs py-0 px-1 flex-shrink-0">
                  {item.badge}
                </Badge>
              )}
              <Check
                className={cn(
                  "h-4 w-4 text-primary flex-shrink-0",
                  value === item.id ? "opacity-100" : "opacity-0"
                )}
              />
            </button>
          ))
        )}
      </div>
    </div>
  );

  // Mobile: Use Drawer with proper trigger
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={handleOpenChange}>
        <button
          type="button"
          onClick={() => !disabled && setOpen(true)}
          className="w-full text-left"
          disabled={disabled}
        >
          {TriggerButton}
        </button>
        <DrawerContent className="bg-background">
          <DrawerHeader className="text-left">
            <DrawerTitle>{title}</DrawerTitle>
          </DrawerHeader>
          <div className="px-4 pb-4">
            {ItemsList}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  // Desktop: Use Popover
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild disabled={disabled}>
        {TriggerButton}
      </PopoverTrigger>
      <PopoverContent 
        className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border shadow-lg z-50" 
        align="start"
      >
        {ItemsList}
      </PopoverContent>
    </Popover>
  );
}
