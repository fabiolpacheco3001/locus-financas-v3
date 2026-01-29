-- Migration: Implement Message Contract for i18n
-- Replace title/message with message_key/params for all notifications

-- Step 1: Add new columns
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS message_key text,
ADD COLUMN IF NOT EXISTS params jsonb DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS severity text,
ADD COLUMN IF NOT EXISTS entity_type text,
ADD COLUMN IF NOT EXISTS entity_id text,
ADD COLUMN IF NOT EXISTS status text DEFAULT 'unread';

-- Step 2: Migrate existing data - convert title+message to message_key+params
-- For existing notifications, we'll set message_key based on event_type
UPDATE public.notifications
SET 
  message_key = CASE 
    WHEN event_type = 'PAYMENT_DELAYED' THEN 
      CASE 
        WHEN (metadata->>'count')::int = 1 THEN 'notifications.messages.payment_delayed_single'
        ELSE 'notifications.messages.payment_delayed_multiple'
      END
    WHEN event_type = 'MONTH_AT_RISK' THEN 'notifications.messages.month_at_risk'
    WHEN event_type = 'MONTH_AT_RISK_PREVIEW' THEN 'notifications.messages.month_at_risk_preview'
    WHEN event_type = 'UPCOMING_EXPENSE_COVERAGE_RISK' THEN 'notifications.messages.coverage_risk'
    WHEN event_type = 'MONTH_RECOVERED' THEN 'notifications.messages.month_recovered'
    WHEN event_type = 'RISK_REDUCED' THEN 'notifications.messages.risk_reduced'
    WHEN event_type = 'RECURRING_LATE_PAYMENT' THEN 'notifications.messages.recurring_late_payment'
    WHEN event_type = 'MISSING_RECURRING_EXPENSE' THEN 'notifications.messages.missing_recurring_expense'
    ELSE 'notifications.messages.generic'
  END,
  params = COALESCE(metadata, '{}'::jsonb),
  severity = COALESCE(type, 'info'),
  entity_type = CASE 
    WHEN event_type IN ('PAYMENT_DELAYED', 'UPCOMING_EXPENSE_COVERAGE_RISK') THEN 'transaction'
    WHEN event_type IN ('MONTH_AT_RISK', 'MONTH_AT_RISK_PREVIEW', 'MONTH_RECOVERED') THEN 'month'
    ELSE 'generic'
  END,
  entity_id = reference_id,
  status = CASE 
    WHEN dismissed_at IS NOT NULL THEN 'archived'
    WHEN read_at IS NOT NULL THEN 'read'
    ELSE 'unread'
  END
WHERE message_key IS NULL;

-- Step 3: Make message_key required for new notifications
ALTER TABLE public.notifications
ALTER COLUMN message_key SET NOT NULL;

-- Step 4: Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_notifications_message_key ON public.notifications(message_key);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(status);

-- Step 5: Update cta_label to cta_label_key for i18n
ALTER TABLE public.notifications
ADD COLUMN IF NOT EXISTS cta_label_key text;

-- Migrate existing cta_label to cta_label_key
UPDATE public.notifications
SET cta_label_key = CASE 
    WHEN cta_label = 'Ver transações' THEN 'common.viewTransactions'
    WHEN cta_label = 'Ver transação' THEN 'common.viewTransaction'
    WHEN cta_label = 'Ver detalhes' THEN 'common.viewDetails'
    ELSE NULL
  END
WHERE cta_label IS NOT NULL AND cta_label_key IS NULL;

-- Step 6: Drop old text columns (title/message)
-- Note: Keeping them temporarily for backward compatibility
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS title;
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS message;
-- ALTER TABLE public.notifications DROP COLUMN IF EXISTS cta_label;
-- We'll comment out the DROP for now to allow gradual migration