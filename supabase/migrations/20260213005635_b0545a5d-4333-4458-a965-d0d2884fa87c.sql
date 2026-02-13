
CREATE OR REPLACE FUNCTION public.can_view_request(_user_id uuid, _request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
    AND (
      r.created_by = _user_id
      OR (public.has_role(_user_id, 'revisor') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'ejecutor') AND r.status IN ('aprobada', 'en_ejecucion', 'en_espera', 'completada', 'anulada'))
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;
