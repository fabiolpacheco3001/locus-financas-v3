import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tag, ChevronRight, Check, Search } from 'lucide-react';
import { useLocale } from '@/i18n/useLocale';
import { cn } from '@/lib/utils';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';

interface CategoryOption {
  id: string;
  name: string;
  subcategories?: Array<{ id: string; name: string }>;
}

interface CategoryTreeComboboxProps {
  categories: CategoryOption[];
  selectedCategoryId?: string;
  selectedSubcategoryId?: string;
  onCategoryChange: (categoryId: string | undefined) => void;
  onSubcategoryChange: (subcategoryId: string | undefined) => void;
  variant?: 'default' | 'pill';
  className?: string;
}

export function CategoryTreeCombobox({
  categories,
  selectedCategoryId,
  selectedSubcategoryId,
  onCategoryChange,
  onSubcategoryChange,
  variant = 'default',
  className,
}: CategoryTreeComboboxProps) {
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  // Find selected category and subcategory names for display
  const selectedCategory = useMemo(() => 
    categories.find(c => c.id === selectedCategoryId), 
    [categories, selectedCategoryId]
  );
  
  const selectedSubcategory = useMemo(() => 
    selectedCategory?.subcategories?.find(s => s.id === selectedSubcategoryId),
    [selectedCategory, selectedSubcategoryId]
  );

  // Build display label
  const displayLabel = useMemo(() => {
    if (selectedSubcategory && selectedCategory) {
      return `${selectedCategory.name} › ${selectedSubcategory.name}`;
    }
    if (selectedCategory) {
      return selectedCategory.name;
    }
    return t('filters.allCategories');
  }, [selectedCategory, selectedSubcategory, t]);

  // Filter categories based on search
  const filteredCategories = useMemo(() => {
    if (!search.trim()) return categories;
    
    const lowerSearch = search.toLowerCase();
    return categories.filter(category => {
      // Check if category name matches
      if (category.name.toLowerCase().includes(lowerSearch)) return true;
      // Check if any subcategory matches
      return category.subcategories?.some(sub => 
        sub.name.toLowerCase().includes(lowerSearch)
      );
    });
  }, [categories, search]);

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setSearch('');
    }
  };

  const handleSelectCategory = (categoryId: string) => {
    if (categoryId === 'all') {
      onCategoryChange(undefined);
      onSubcategoryChange(undefined);
    } else {
      // If clicking the same category, clear it
      if (categoryId === selectedCategoryId && !selectedSubcategoryId) {
        onCategoryChange(undefined);
      } else {
        onCategoryChange(categoryId);
        onSubcategoryChange(undefined);
      }
    }
    setOpen(false);
    setSearch('');
  };

  const handleSelectSubcategory = (categoryId: string, subcategoryId: string) => {
    onCategoryChange(categoryId);
    onSubcategoryChange(subcategoryId);
    setOpen(false);
    setSearch('');
  };

  const isActive = !!(selectedCategoryId || selectedSubcategoryId);

  const triggerClasses = variant === 'pill' 
    ? cn(
        "h-8 w-auto gap-1.5 rounded-full border-border/60 bg-background px-3 text-sm font-normal justify-start",
        isActive && "border-primary/50 bg-primary/5 text-primary",
        className
      )
    : cn("w-full justify-between", className);

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={triggerClasses}
          data-testid="category-tree-combobox"
        >
          {variant === 'pill' && <Tag className="h-3.5 w-3.5 shrink-0" />}
          <span className={cn(
            "truncate",
            variant === 'pill' ? "max-w-[150px]" : ""
          )}>
            {displayLabel}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-72 p-0 z-50 bg-popover" 
        align="start"
        sideOffset={4}
      >
        <div className="flex flex-col">
          {/* Search Input */}
          <div className="p-2 border-b border-border">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder={t('common.search')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 h-10 bg-background"
                data-testid="category-search-input"
              />
            </div>
          </div>

          {/* Categories List with Native Buttons */}
          <div 
            className="max-h-64 overflow-y-auto custom-scrollbar"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {filteredCategories.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('common.noResults')}
              </p>
            ) : (
              <div className="p-1">
                {/* "All Categories" option */}
                <button
                  type="button"
                  onClick={() => handleSelectCategory('all')}
                  className={cn(
                    "w-full flex items-center gap-2 p-2 text-left rounded-md transition-colors",
                    "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                    !selectedCategoryId && "bg-accent"
                  )}
                  data-testid="category-option-all"
                >
                  <Check className={cn(
                    "h-4 w-4 shrink-0",
                    !selectedCategoryId ? "opacity-100" : "opacity-0"
                  )} />
                  <span className="font-medium">{t('filters.allCategories')}</span>
                </button>

                {/* Grouped categories */}
                {filteredCategories.map(category => (
                  <div key={category.id} className="mt-1">
                    {/* Category header button */}
                    <button
                      type="button"
                      onClick={() => handleSelectCategory(category.id)}
                      className={cn(
                        "w-full flex items-center gap-2 p-2 text-left rounded-md transition-colors",
                        "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                        selectedCategoryId === category.id && !selectedSubcategoryId && "bg-accent"
                      )}
                      data-testid={`category-option-${category.id}`}
                    >
                      <Check className={cn(
                        "h-4 w-4 shrink-0",
                        selectedCategoryId === category.id && !selectedSubcategoryId ? "opacity-100" : "opacity-0"
                      )} />
                      <span className="font-semibold">{category.name}</span>
                      {category.subcategories && category.subcategories.length > 0 && (
                        <span className="ml-auto text-[10px] text-muted-foreground">
                          {category.subcategories.length}
                        </span>
                      )}
                    </button>

                    {/* Subcategories */}
                    {category.subcategories?.map(sub => (
                      <button
                        key={sub.id}
                        type="button"
                        onClick={() => handleSelectSubcategory(category.id, sub.id)}
                        className={cn(
                          "w-full flex items-center gap-2 pl-8 pr-2 py-2 text-left rounded-md transition-colors",
                          "hover:bg-accent hover:text-accent-foreground cursor-pointer",
                          selectedSubcategoryId === sub.id && "bg-accent"
                        )}
                        data-testid={`subcategory-option-${sub.id}`}
                      >
                        <Check className={cn(
                          "h-3.5 w-3.5 shrink-0",
                          selectedSubcategoryId === sub.id ? "opacity-100" : "opacity-0"
                        )} />
                        <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                        <span>{sub.name}</span>
                      </button>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
