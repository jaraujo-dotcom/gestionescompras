CREATE OR REPLACE FUNCTION public.can_view_request(_user_id uuid, _request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    LEFT JOIN public.form_templates ft ON ft.id = r.template_id
    WHERE r.id = _request_id
    AND (
      r.created_by = _user_id
      OR (r.group_id IS NOT NULL AND public.user_in_group(_user_id, r.group_id) AND public.has_role(_user_id, 'gerencia'))
      OR (public.has_role(_user_id, 'revisor') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'procesos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'integridad_datos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'ejecutor') AND (
        r.status IN ('aprobada', 'en_ejecucion', 'en_espera', 'completada', 'anulada')
        OR (ft.executor_group_id IS NOT NULL AND public.user_in_group(_user_id, ft.executor_group_id) AND r.status NOT IN ('borrador'))
      ))
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;