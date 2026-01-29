
-- Create notifications table
CREATE TABLE public.notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  household_id uuid NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('info', 'warning', 'action', 'success')),
  event_type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  cta_label text,
  cta_target text,
  reference_id uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  read_at timestamp with time zone,
  dismissed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Users can view own household notifications"
ON public.notifications FOR SELECT
USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can insert notifications for own household"
ON public.notifications FOR INSERT
WITH CHECK (household_id = public.get_user_household_id());

CREATE POLICY "Users can update own household notifications"
ON public.notifications FOR UPDATE
USING (household_id = public.get_user_household_id());

CREATE POLICY "Users can delete own household notifications"
ON public.notifications FOR DELETE
USING (household_id = public.get_user_household_id());

-- Indexes for performance
CREATE INDEX idx_notifications_household ON public.notifications(household_id);
CREATE INDEX idx_notifications_created ON public.notifications(created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications(household_id, read_at) WHERE read_at IS NULL;
CREATE INDEX idx_notifications_event_type ON public.notifications(household_id, event_type);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
