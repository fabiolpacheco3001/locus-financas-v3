import { useState, useMemo } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { useCategories } from '@/hooks/useCategories';
import { useLocale } from '@/i18n/useLocale';
import { Plus, Pencil, Archive, ArchiveRestore, Tags, FolderOpen, Loader2, Eye, EyeOff } from 'lucide-react';
import { Category, Subcategory } from '@/types/finance';

export default function CategoriesPage() {
  const { user, loading: authLoading } = useAuth();
  const { 
    categories, // All categories including archived
    activeCategories, 
    archivedCategories,
    isLoading, 
    createCategory, 
    updateCategory, 
    archiveCategory,
    restoreCategory,
    createSubcategory, 
    archiveSubcategory,
    restoreSubcategory
  } = useCategories();
  const { t } = useLocale();

  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSubcategoryDialogOpen, setIsSubcategoryDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  
  // Archive dialog state
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [archiveTarget, setArchiveTarget] = useState<{ id: string; type: 'category' | 'subcategory' } | null>(null);
  
  const [formName, setFormName] = useState('');
  const [formExcluded, setFormExcluded] = useState(false);
  const [formEssential, setFormEssential] = useState(false);
  const [subcategoryName, setSubcategoryName] = useState('');

  // Build display list based on showArchived toggle
  const displayCategories = useMemo(() => {
    if (showArchived) {
      // Show all categories, sorted alphabetically
      // Include all subcategories (active + archived)
      return categories
        .map(c => ({
          ...c,
          subcategories: c.subcategories?.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')) || []
        }))
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    } else {
      // Show only active categories with only active subcategories
      return activeCategories
        .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
    }
  }, [categories, activeCategories, showArchived]);

  const hasArchivedItems = archivedCategories.length > 0 || 
    categories.some(c => c.subcategories?.some(s => s.archived_at));

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/auth" replace />;
  }

  const resetCategoryForm = () => {
    setEditingId(null);
    setFormName('');
    setFormExcluded(false);
    setFormEssential(false);
  };

  const openNewCategoryDialog = () => {
    resetCategoryForm();
    setIsCategoryDialogOpen(true);
  };

  const openEditCategoryDialog = (category: Category) => {
    setEditingId(category.id);
    setFormName(category.name);
    setFormExcluded(category.is_budget_excluded);
    setFormEssential(category.is_essential);
    setIsCategoryDialogOpen(true);
  };

  const openSubcategoryDialog = (categoryId: string) => {
    setSelectedCategoryId(categoryId);
    setSubcategoryName('');
    setIsSubcategoryDialogOpen(true);
  };

  const handleCategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      if (editingId) {
        await updateCategory.mutateAsync({ 
          id: editingId, 
          name: formName, 
          is_budget_excluded: formExcluded,
          is_essential: formEssential
        });
      } else {
        await createCategory.mutateAsync({ 
          name: formName, 
          is_budget_excluded: formExcluded,
          is_essential: formEssential
        });
      }
      
      setIsCategoryDialogOpen(false);
      resetCategoryForm();
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const handleSubcategorySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategoryId) return;
    
    try {
      await createSubcategory.mutateAsync({ category_id: selectedCategoryId, name: subcategoryName });
      setIsSubcategoryDialogOpen(false);
      setSubcategoryName('');
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const openArchiveDialog = (id: string, type: 'category' | 'subcategory') => {
    setArchiveTarget({ id, type });
    setArchiveDialogOpen(true);
  };

  const handleConfirmArchive = async () => {
    if (!archiveTarget) return;
    
    try {
      if (archiveTarget.type === 'category') {
        await archiveCategory.mutateAsync(archiveTarget.id);
      } else {
        await archiveSubcategory.mutateAsync(archiveTarget.id);
      }
    } catch {
      // Error already handled by mutation's onError
    } finally {
      setArchiveDialogOpen(false);
      setArchiveTarget(null);
    }
  };

  const handleRestoreCategory = async (id: string) => {
    try {
      await restoreCategory.mutateAsync(id);
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const handleRestoreSubcategory = async (id: string) => {
    try {
      await restoreSubcategory.mutateAsync(id);
    } catch {
      // Error already handled by mutation's onError
    }
  };

  const renderSubcategoryItem = (sub: Subcategory, categoryIsArchived: boolean) => {
    const isArchived = sub.archived_at != null;
    
    // If not showing archived and this subcategory is archived, don't render
    if (!showArchived && isArchived) return null;
    
    return (
      <div 
        key={sub.id} 
        className={`flex items-center justify-between rounded-md px-3 py-2 ${
          isArchived ? 'bg-muted/20 opacity-60' : 'bg-muted/50'
        }`}
      >
        <span className={`text-sm ${isArchived ? 'text-muted-foreground line-through' : ''}`}>
          {sub.name}
          {isArchived && (
            <Badge variant="outline" className="ml-2 text-xs text-muted-foreground border-muted-foreground/50">
              {t('categories.archived')}
            </Badge>
          )}
        </span>
        {isArchived ? (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleRestoreSubcategory(sub.id)}>
            <ArchiveRestore className="h-3 w-3 text-muted-foreground" />
          </Button>
        ) : !categoryIsArchived && (
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openArchiveDialog(sub.id, 'subcategory')}>
            <Archive className="h-3 w-3 text-muted-foreground" />
          </Button>
        )}
      </div>
    );
  };

  const renderCategoryItem = (category: Category) => {
    const isArchived = category.archived_at != null;
    const visibleSubcategories = showArchived 
      ? category.subcategories 
      : category.subcategories?.filter(s => !s.archived_at);
    
    return (
      <AccordionItem 
        key={category.id} 
        value={category.id} 
        className={`rounded-lg border bg-card ${
          isArchived ? 'border-muted-foreground/30 opacity-70' : 'border-border'
        }`}
      >
        <AccordionTrigger className="px-4 hover:no-underline">
          <div className="flex flex-1 items-center justify-between pr-4">
            <div className="flex items-center gap-3">
              <FolderOpen className={`h-5 w-5 ${isArchived ? 'text-muted-foreground/50' : 'text-muted-foreground'}`} />
              <span className={`font-medium ${isArchived ? 'text-muted-foreground line-through' : ''}`}>
                {category.name}
              </span>
              {category.is_essential && !isArchived && (
                <Badge variant="default" className="text-xs bg-primary/10 text-primary border-primary/20">
                  {t('categories.essential')}
                </Badge>
              )}
              {category.is_budget_excluded && !isArchived && (
                <Badge variant="secondary" className="text-xs">
                  {t('common.excludedFromBudget')}
                </Badge>
              )}
              {isArchived && (
                <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/50">
                  {t('categories.archived')}
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {t('common.subcategoriesCount', { count: visibleSubcategories?.length || 0 })}
            </span>
          </div>
        </AccordionTrigger>
        <AccordionContent className="border-t border-border px-4 pb-4 pt-4">
          <div className="mb-4 flex gap-2">
            {isArchived ? (
              <Button size="sm" variant="outline" onClick={() => handleRestoreCategory(category.id)}>
                <ArchiveRestore className="mr-2 h-3 w-3" />
                {t('categories.restore')}
              </Button>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={() => openEditCategoryDialog(category)}>
                  <Pencil className="mr-2 h-3 w-3" />
                  {t('common.edit')}
                </Button>
                <Button size="sm" variant="outline" onClick={() => openSubcategoryDialog(category.id)}>
                  <Plus className="mr-2 h-3 w-3" />
                  {t('categories.subcategory')}
                </Button>
                <Button size="sm" variant="outline" className="text-muted-foreground hover:bg-muted" onClick={() => openArchiveDialog(category.id, 'category')}>
                  <Archive className="mr-2 h-3 w-3" />
                  {t('categories.archive')}
                </Button>
              </>
            )}
          </div>

          {visibleSubcategories && visibleSubcategories.length > 0 ? (
            <div className="space-y-2">
              {visibleSubcategories.map(sub => renderSubcategoryItem(sub, isArchived))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('common.noSubcategories')}</p>
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };

  return (
    <AppLayout>
      <PageHeader
        title={t('categories.title')}
        description={t('categories.description')}
        actions={
          <div className="flex items-center gap-4">
            {hasArchivedItems && (
              <div className="flex items-center gap-2">
                <Switch 
                  id="show-archived"
                  checked={showArchived} 
                  onCheckedChange={setShowArchived}
                />
                <Label htmlFor="show-archived" className="flex items-center gap-1.5 text-sm text-muted-foreground cursor-pointer">
                  {showArchived ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                  {showArchived ? t('categories.hideArchived') : t('categories.showArchived')}
                </Label>
              </div>
            )}
            <Button onClick={openNewCategoryDialog}>
              <Plus className="mr-2 h-4 w-4" />
              {t('categories.new')}
            </Button>
          </div>
        }
      />

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : displayCategories.length === 0 ? (
        <EmptyState
          icon={Tags}
          title={showArchived ? t('categories.empty.title') : t('categories.empty.title')}
          description={showArchived ? t('categories.empty.description') : t('categories.empty.description')}
          actionLabel={t('categories.new')}
          onAction={openNewCategoryDialog}
        />
      ) : (
        <div className="space-y-4">
          <Accordion type="multiple" className="space-y-2">
            {displayCategories.map(category => renderCategoryItem(category))}
          </Accordion>
        </div>
      )}

      {/* Category Dialog */}
      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingId ? t('categories.edit') : t('categories.new')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleCategorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('categories.name')}</Label>
              <Input
                placeholder={t('categories.namePlaceholder')}
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
              />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-sm">{t('categories.isEssential')}</p>
                <p className="text-xs text-muted-foreground">{t('categories.isEssentialDesc')}</p>
              </div>
              <Switch checked={formEssential} onCheckedChange={setFormEssential} />
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="font-medium text-sm">{t('categories.excludeFromBudget')}</p>
                <p className="text-xs text-muted-foreground">{t('common.excludeFromBudgetDesc')}</p>
              </div>
              <Switch checked={formExcluded} onCheckedChange={setFormExcluded} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCategoryDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createCategory.isPending || updateCategory.isPending}>
                {(createCategory.isPending || updateCategory.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingId ? t('common.save') : t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Subcategory Dialog */}
      <Dialog open={isSubcategoryDialogOpen} onOpenChange={setIsSubcategoryDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('categories.newSubcategory')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubcategorySubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>{t('categories.name')}</Label>
              <Input
                placeholder={t('categories.subcategoryPlaceholder')}
                value={subcategoryName}
                onChange={(e) => setSubcategoryName(e.target.value)}
                required
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsSubcategoryDialogOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={createSubcategory.isPending}>
                {createSubcategory.isPending && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {t('common.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Archive Confirmation Dialog */}
      <AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {archiveTarget?.type === 'category' 
                ? t('categories.archiveDialog.title') 
                : t('categories.archiveDialog.titleSubcategory')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('categories.archiveDialog.description')}</p>
              {archiveTarget?.type === 'category' && (
                <p className="font-medium">{t('categories.archiveDialog.descriptionCategory')}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('categories.archiveDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmArchive}>
              {t('categories.archiveDialog.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
