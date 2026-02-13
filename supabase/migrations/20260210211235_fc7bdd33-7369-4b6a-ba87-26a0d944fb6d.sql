
-- Fix overly permissive INSERT policy
DROP POLICY "Service role can insert notifications" ON public.notifications;

-- Only allow inserting notifications for yourself (edge function uses service_role which bypasses RLS)
CREATE POLICY "Users can insert own notifications"
ON public.notifications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);
