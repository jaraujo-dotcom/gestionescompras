
-- 1. Add executor_group_id column to form_templates
ALTER TABLE public.form_templates
  ADD COLUMN executor_group_id uuid REFERENCES public.groups(id) ON DELETE SET NULL;

-- 2. Update can_view_request to include executor group logic
CREATE OR REPLACE FUNCTION public.can_view_request(_user_id uuid, _request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    LEFT JOIN public.form_templates ft ON ft.id = r.template_id
    WHERE r.id = _request_id
    AND (
      -- Creator can always see their own
      r.created_by = _user_id
      -- Group-based: any user in the same group can see group requests
      OR (r.group_id IS NOT NULL AND public.user_in_group(_user_id, r.group_id))
      -- Revisor: all non-draft requests
      OR (public.has_role(_user_id, 'revisor') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      -- Procesos: all non-draft requests
      OR (public.has_role(_user_id, 'procesos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      -- Integridad de datos: all non-draft requests
      OR (public.has_role(_user_id, 'integridad_datos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      -- Ejecutor: requests in execution statuses OR requests whose template has an executor_group the user belongs to
      OR (public.has_role(_user_id, 'ejecutor') AND (
        r.status IN ('aprobada', 'en_ejecucion', 'en_espera', 'completada', 'anulada')
        OR (ft.executor_group_id IS NOT NULL AND public.user_in_group(_user_id, ft.executor_group_id) AND r.status NOT IN ('borrador'))
      ))
      -- Admin: everything
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;
