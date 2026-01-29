-- =========================================
-- SECURITY STRATEGY SHIFT: Creator-Only Invites & User-Specific Notifications
-- =========================================

-- =====================
-- PART 1: HOUSEHOLD_INVITES - Creator Only Access
-- =====================

-- Drop ALL existing SELECT policies
DROP POLICY IF EXISTS "scanner_compliant_select" ON public.household_invites;
DROP POLICY IF EXISTS "creators_or_recipients_select" ON public.household_invites;
DROP POLICY IF EXISTS "deny_all_select" ON public.household_invites;

-- Create CREATOR-ONLY policy (recipients use RPC: get_my_pending_invites)
CREATE POLICY "creators_only_select" ON public.household_invites
FOR SELECT TO authenticated
USING (created_by_user_id = auth.uid());

-- =====================
-- PART 2: NOTIFICATIONS - User-Specific Access
-- =====================

-- Add target_user_id column for user-specific notifications
-- NULL = household-wide notification (visible to all members)
-- NOT NULL = user-specific notification (visible only to that user)
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS target_user_id uuid REFERENCES auth.users(id);

-- Drop existing permissive household-wide policies
DROP POLICY IF EXISTS "Users can view own household notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert notifications for own household" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own household notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete own household notifications" ON public.notifications;

-- Create restrictive SELECT policy:
-- User can see notification if:
-- 1. It's household-wide (target_user_id IS NULL) AND they belong to the household, OR
-- 2. It's targeted specifically at them (target_user_id = auth.uid())
CREATE POLICY "notifications_select_private" ON public.notifications
FOR SELECT TO authenticated
USING (
  (target_user_id IS NULL AND household_id = get_user_household_id())
  OR
  target_user_id = auth.uid()
);

-- INSERT: User can create notifications for their household
CREATE POLICY "notifications_insert" ON public.notifications
FOR INSERT TO authenticated
WITH CHECK (household_id = get_user_household_id());

-- UPDATE: User can only update notifications they can see
CREATE POLICY "notifications_update" ON public.notifications
FOR UPDATE TO authenticated
USING (
  (target_user_id IS NULL AND household_id = get_user_household_id())
  OR
  target_user_id = auth.uid()
);

-- DELETE: User can only delete notifications they can see
CREATE POLICY "notifications_delete" ON public.notifications
FOR DELETE TO authenticated
USING (
  (target_user_id IS NULL AND household_id = get_user_household_id())
  OR
  target_user_id = auth.uid()
);

-- Add index for performance
CREATE INDEX IF NOT EXISTS idx_notifications_target_user ON public.notifications(target_user_id) WHERE target_user_id IS NOT NULL;

-- Update table comments
COMMENT ON TABLE public.household_invites IS 'RLS: SELECT restricted to creator ONLY. Recipients access via get_my_pending_invites RPC.';
COMMENT ON COLUMN public.notifications.target_user_id IS 'If NULL: household-wide notification. If set: user-specific notification visible only to that user.';