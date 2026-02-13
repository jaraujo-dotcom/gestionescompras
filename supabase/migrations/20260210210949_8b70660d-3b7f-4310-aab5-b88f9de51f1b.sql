
-- Notifications table for in-app notifications
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('status_change', 'new_comment', 'assignment')),
  title text NOT NULL,
  message text NOT NULL,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_user_unread ON public.notifications(user_id, is_read) WHERE is_read = false;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can only see their own notifications
CREATE POLICY "Users can view own notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can update (mark as read) their own notifications
CREATE POLICY "Users can update own notifications"
ON public.notifications FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Edge functions (service role) can insert notifications
CREATE POLICY "Service role can insert notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (true);

-- Allow delete own notifications
CREATE POLICY "Users can delete own notifications"
ON public.notifications FOR DELETE
TO authenticated
USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

-- Function to get users who should be notified for a request event
CREATE OR REPLACE FUNCTION public.get_notifiable_users(_request_id uuid, _exclude_user_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, user_email text, user_name text, user_role text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  -- Get request creator
  SELECT DISTINCT p.id, p.email, p.name, 'solicitante'::text
  FROM requests r
  JOIN profiles p ON p.id = r.created_by
  WHERE r.id = _request_id
    AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  
  UNION
  
  -- Get all revisores
  SELECT DISTINCT p.id, p.email, p.name, 'revisor'::text
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'revisor'
    AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  
  UNION
  
  -- Get all ejecutores
  SELECT DISTINCT p.id, p.email, p.name, 'ejecutor'::text
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'ejecutor'
    AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  
  UNION
  
  -- Get all administradores
  SELECT DISTINCT p.id, p.email, p.name, 'administrador'::text
  FROM user_roles ur
  JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'administrador'
    AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
$$;
