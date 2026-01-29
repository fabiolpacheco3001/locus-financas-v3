-- Add archived_at column to categories
ALTER TABLE public.categories 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;

-- Add archived_at column to subcategories
ALTER TABLE public.subcategories 
ADD COLUMN archived_at TIMESTAMP WITH TIME ZONE NULL;

-- Create index for faster filtering of active categories
CREATE INDEX idx_categories_archived_at ON public.categories (archived_at);

-- Create index for faster filtering of active subcategories
CREATE INDEX idx_subcategories_archived_at ON public.subcategories (archived_at);

-- Create function to cascade archive to subcategories when category is archived
CREATE OR REPLACE FUNCTION public.cascade_archive_subcategories()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- When category is archived, archive all its subcategories
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    UPDATE public.subcategories 
    SET archived_at = NEW.archived_at
    WHERE category_id = NEW.id AND archived_at IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to cascade archive
CREATE TRIGGER trigger_cascade_archive_subcategories
AFTER UPDATE ON public.categories
FOR EACH ROW
WHEN (NEW.archived_at IS DISTINCT FROM OLD.archived_at)
EXECUTE FUNCTION public.cascade_archive_subcategories();

-- Add comment explaining the soft delete pattern
COMMENT ON COLUMN public.categories.archived_at IS 'Soft delete timestamp. When set, category is considered archived.';
COMMENT ON COLUMN public.subcategories.archived_at IS 'Soft delete timestamp. When set, subcategory is considered archived.';