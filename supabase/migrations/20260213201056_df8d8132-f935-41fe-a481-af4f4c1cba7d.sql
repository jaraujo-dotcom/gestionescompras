
-- Fix: user_roles policies are all RESTRICTIVE which blocks access.
-- Drop and recreate as PERMISSIVE.

DROP POLICY IF EXISTS "Admins can delete user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Admins can insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "Users can view own roles or admin can view all" ON public.user_roles;

CREATE POLICY "Admins can delete user_roles"
ON public.user_roles FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Admins can insert user_roles"
ON public.user_roles FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));

CREATE POLICY "Users can view own roles or admin can view all"
ON public.user_roles FOR SELECT TO authenticated
USING ((user_id = auth.uid()) OR has_role(auth.uid(), 'administrador'::app_role));
