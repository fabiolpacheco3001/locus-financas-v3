-- Add metadata column to notifications table for storing additional data like count, details
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- Add comment
COMMENT ON COLUMN public.notifications.metadata IS 'JSON metadata for additional notification data like count of affected items';