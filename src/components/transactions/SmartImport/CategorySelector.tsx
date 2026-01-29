import { useState } from 'react';
import { Search, Tag, ChevronRight } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useIsMobile } from '@/hooks/use-mobile';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';

interface Category {
  id: string;
  name: string;
  icon?: string | null;
  subcategories?: Array<{ id: string; name: string }>;
}

interface CategorySelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: Category[];
  onSelect: (categoryId: string) => void;
}

export function CategorySelector({ open, onOpenChange, categories, onSelect }: CategorySelectorProps) {
  const { t } = useLocale();
  const isMobile = useIsMobile();
  const [search, setSearch] = useState('');

  const filteredCategories = categories.filter(cat =>
    cat.name.toLowerCase().includes(search.toLowerCase()) ||
    cat.subcategories?.some(sub => sub.name.toLowerCase().includes(search.toLowerCase()))
  );

  const handleSelect = (categoryId: string) => {
    onSelect(categoryId);
    onOpenChange(false);
    setSearch('');
  };

  const content = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-border">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('smartImport.searchCategory')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 min-h-[44px]"
            autoFocus
          />
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          {filteredCategories.map((category) => (
            <div key={category.id}>
              <button
                onClick={() => handleSelect(category.id)}
                className={cn(
                  "w-full flex items-center justify-between p-3 rounded-lg transition-colors min-h-[48px]",
                  "hover:bg-muted/50 active:bg-muted"
                )}
              >
                <div className="flex items-center gap-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">{category.name}</span>
                </div>
                {category.subcategories && category.subcategories.length > 0 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
              
              {/* Subcategories */}
              {category.subcategories?.filter(sub => 
                !search || sub.name.toLowerCase().includes(search.toLowerCase())
              ).map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => handleSelect(category.id)}
                  className={cn(
                    "w-full flex items-center gap-2 p-3 pl-10 rounded-lg transition-colors min-h-[44px]",
                    "hover:bg-muted/50 active:bg-muted text-sm text-muted-foreground"
                  )}
                >
                  <span>{sub.name}</span>
                </button>
              ))}
            </div>
          ))}
          
          {filteredCategories.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              {t('common.noResults')}
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>{t('smartImport.selectCategory')}</DrawerTitle>
          </DrawerHeader>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('smartImport.selectCategory')}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[60vh]">
          {content}
        </div>
      </DialogContent>
    </Dialog>
  );
}
