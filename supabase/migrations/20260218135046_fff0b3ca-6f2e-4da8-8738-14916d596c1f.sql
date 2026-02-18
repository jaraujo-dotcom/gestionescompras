
-- Fix: Scope get_profiles_by_ids to only return users whose IDs appear
-- in requests/comments/approvals/history that the caller can already access.
-- This prevents arbitrary user-ID enumeration while keeping the existing
-- call-sites working (they always pass IDs from data they already fetched).

CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.name
  FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND (
      -- Caller is requesting their own profile
      p.id = auth.uid()
      -- OR the profile belongs to someone who has acted on a request
      -- that the caller is allowed to see
      OR EXISTS (
        SELECT 1 FROM public.request_comments rc
        JOIN public.requests r ON r.id = rc.request_id
        WHERE rc.user_id = p.id
          AND public.can_view_request(auth.uid(), r.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.request_status_history rsh
        JOIN public.requests r ON r.id = rsh.request_id
        WHERE rsh.changed_by = p.id
          AND public.can_view_request(auth.uid(), r.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.request_approvals ra
        JOIN public.requests r ON r.id = ra.request_id
        WHERE ra.approved_by = p.id
          AND public.can_view_request(auth.uid(), r.id)
      )
      OR EXISTS (
        SELECT 1 FROM public.requests r
        WHERE r.created_by = p.id
          AND public.can_view_request(auth.uid(), r.id)
      )
      -- Admins can look up any user name
      OR public.has_role(auth.uid(), 'administrador'::app_role)
    );
$$;
