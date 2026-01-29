-- ============================================
-- Notification Engine: Due Today Trigger
-- Creates notifications when expenses are due today
-- ============================================

-- Create a function to insert/update notification for due expenses
CREATE OR REPLACE FUNCTION public.notify_expense_due_today()
RETURNS TRIGGER AS $$
DECLARE
  v_household_id uuid;
  v_dedupe_key text;
  v_existing_id uuid;
  v_category_name text;
  v_subcategory_name text;
  v_description text;
BEGIN
  -- Only trigger for EXPENSE with pending status and due_date = today
  IF NEW.kind != 'EXPENSE' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.status != 'planned' THEN
    RETURN NEW;
  END IF;
  
  IF NEW.due_date IS NULL OR NEW.due_date::date != CURRENT_DATE THEN
    RETURN NEW;
  END IF;
  
  -- Skip if cancelled
  IF NEW.cancelled_at IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_household_id := NEW.household_id;
  v_dedupe_key := 'DUE_TODAY:' || NEW.id::text;
  
  -- Get category/subcategory names for the notification
  SELECT c.name INTO v_category_name
  FROM public.categories c
  WHERE c.id = NEW.category_id;
  
  SELECT s.name INTO v_subcategory_name
  FROM public.subcategories s
  WHERE s.id = NEW.subcategory_id;
  
  v_description := COALESCE(NEW.description, v_subcategory_name, v_category_name, 'Despesa');
  
  -- Check if notification already exists (idempotency)
  SELECT id INTO v_existing_id
  FROM public.notifications
  WHERE household_id = v_household_id
    AND dedupe_key = v_dedupe_key
    AND dismissed_at IS NULL
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    -- Already notified, skip
    RETURN NEW;
  END IF;
  
  -- Insert new notification
  INSERT INTO public.notifications (
    household_id,
    event_type,
    type,
    severity,
    title,
    message,
    message_key,
    params,
    dedupe_key,
    entity_type,
    entity_id,
    reference_id,
    cta_label_key,
    cta_target
  ) VALUES (
    v_household_id,
    'EXPENSE_DUE_TODAY',
    'warning',
    'warning',
    'Conta vence hoje',
    v_description || ' vence hoje. Valor: R$ ' || NEW.amount::text,
    'notifications.messages.expense_due_today',
    jsonb_build_object(
      'description', v_description,
      'amount', NEW.amount,
      'transactionId', NEW.id,
      'categoryName', COALESCE(v_category_name, ''),
      'subcategoryName', COALESCE(v_subcategory_name, '')
    ),
    v_dedupe_key,
    'transaction',
    NEW.id::text,
    NEW.id::text,
    'common.cta.view_transaction',
    '/transactions?view=single&id=' || NEW.id::text
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create trigger on INSERT (new transaction with due_date = today)
DROP TRIGGER IF EXISTS trg_notify_expense_due_today_insert ON public.transactions;
CREATE TRIGGER trg_notify_expense_due_today_insert
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_expense_due_today();

-- Create trigger on UPDATE (transaction updated to have due_date = today)
DROP TRIGGER IF EXISTS trg_notify_expense_due_today_update ON public.transactions;
CREATE TRIGGER trg_notify_expense_due_today_update
  AFTER UPDATE OF due_date, status ON public.transactions
  FOR EACH ROW
  WHEN (NEW.due_date IS DISTINCT FROM OLD.due_date OR NEW.status IS DISTINCT FROM OLD.status)
  EXECUTE FUNCTION public.notify_expense_due_today();

-- ============================================
-- Helper function to check and create notifications for all due today
-- Can be called manually or via scheduled job
-- ============================================
CREATE OR REPLACE FUNCTION public.check_expenses_due_today(p_household_id uuid DEFAULT NULL)
RETURNS TABLE (
  transaction_id uuid,
  description text,
  amount numeric,
  notification_created boolean
) AS $$
DECLARE
  v_tx RECORD;
  v_dedupe_key text;
  v_existing_id uuid;
  v_category_name text;
  v_subcategory_name text;
  v_desc text;
BEGIN
  FOR v_tx IN
    SELECT t.*
    FROM public.transactions t
    WHERE t.kind = 'EXPENSE'
      AND t.status = 'planned'
      AND t.due_date::date = CURRENT_DATE
      AND t.cancelled_at IS NULL
      AND (p_household_id IS NULL OR t.household_id = p_household_id)
  LOOP
    v_dedupe_key := 'DUE_TODAY:' || v_tx.id::text;
    
    -- Check if already notified
    SELECT n.id INTO v_existing_id
    FROM public.notifications n
    WHERE n.household_id = v_tx.household_id
      AND n.dedupe_key = v_dedupe_key
      AND n.dismissed_at IS NULL
    LIMIT 1;
    
    IF v_existing_id IS NOT NULL THEN
      -- Already notified
      transaction_id := v_tx.id;
      description := v_tx.description;
      amount := v_tx.amount;
      notification_created := false;
      RETURN NEXT;
      CONTINUE;
    END IF;
    
    -- Get category/subcategory names
    SELECT c.name INTO v_category_name
    FROM public.categories c
    WHERE c.id = v_tx.category_id;
    
    SELECT s.name INTO v_subcategory_name
    FROM public.subcategories s
    WHERE s.id = v_tx.subcategory_id;
    
    v_desc := COALESCE(v_tx.description, v_subcategory_name, v_category_name, 'Despesa');
    
    -- Create notification
    INSERT INTO public.notifications (
      household_id,
      event_type,
      type,
      severity,
      title,
      message,
      message_key,
      params,
      dedupe_key,
      entity_type,
      entity_id,
      reference_id,
      cta_label_key,
      cta_target
    ) VALUES (
      v_tx.household_id,
      'EXPENSE_DUE_TODAY',
      'warning',
      'warning',
      'Conta vence hoje',
      v_desc || ' vence hoje. Valor: R$ ' || v_tx.amount::text,
      'notifications.messages.expense_due_today',
      jsonb_build_object(
        'description', v_desc,
        'amount', v_tx.amount,
        'transactionId', v_tx.id,
        'categoryName', COALESCE(v_category_name, ''),
        'subcategoryName', COALESCE(v_subcategory_name, '')
      ),
      v_dedupe_key,
      'transaction',
      v_tx.id::text,
      v_tx.id::text,
      'common.cta.view_transaction',
      '/transactions?view=single&id=' || v_tx.id::text
    );
    
    transaction_id := v_tx.id;
    description := v_tx.description;
    amount := v_tx.amount;
    notification_created := true;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;