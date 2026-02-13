
-- Create request_approvals table
CREATE TABLE public.request_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid REFERENCES public.requests(id) ON DELETE CASCADE NOT NULL,
  role text NOT NULL,
  approved_by uuid NOT NULL,
  status text NOT NULL DEFAULT 'pendiente',
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(request_id, role)
);

-- Validation trigger
CREATE OR REPLACE FUNCTION public.validate_approval_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pendiente', 'aprobada', 'rechazada', 'devuelta') THEN
    RAISE EXCEPTION 'Invalid approval status: %', NEW.status;
  END IF;
  IF NEW.role NOT IN ('gerencia', 'procesos', 'integridad_datos') THEN
    RAISE EXCEPTION 'Invalid approval role: %', NEW.role;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_approval_status_trigger
BEFORE INSERT OR UPDATE ON public.request_approvals
FOR EACH ROW
EXECUTE FUNCTION public.validate_approval_status();

CREATE TRIGGER update_request_approvals_updated_at
BEFORE UPDATE ON public.request_approvals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable RLS
ALTER TABLE public.request_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view approvals for accessible requests"
ON public.request_approvals FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.requests r 
  WHERE r.id = request_approvals.request_id 
  AND public.can_view_request(auth.uid(), r.id)
));

CREATE POLICY "Approvers can insert approvals"
ON public.request_approvals FOR INSERT
WITH CHECK (
  approved_by = auth.uid() AND
  (
    (role = 'gerencia' AND public.has_role(auth.uid(), 'gerencia')) OR
    (role = 'procesos' AND public.has_role(auth.uid(), 'procesos')) OR
    (role = 'integridad_datos' AND public.has_role(auth.uid(), 'integridad_datos'))
  )
);

CREATE POLICY "Approvers can update their approvals"
ON public.request_approvals FOR UPDATE
USING (approved_by = auth.uid());

CREATE POLICY "Can delete approvals for own or admin requests"
ON public.request_approvals FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = request_approvals.request_id
    AND (r.created_by = auth.uid() OR public.has_role(auth.uid(), 'administrador'))
  )
);

-- Update can_view_request to include new roles
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
      OR (public.has_role(_user_id, 'gerencia') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'procesos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'integridad_datos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'ejecutor') AND r.status IN ('aprobada', 'en_ejecucion', 'en_espera', 'completada', 'anulada'))
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;

-- Update requests UPDATE policy
DROP POLICY IF EXISTS "Users can update own draft/returned requests" ON public.requests;
CREATE POLICY "Users can update own draft/returned requests"
ON public.requests FOR UPDATE
USING (
  (created_by = auth.uid() AND status IN ('borrador', 'devuelta'))
  OR public.has_role(auth.uid(), 'revisor')
  OR public.has_role(auth.uid(), 'gerencia')
  OR public.has_role(auth.uid(), 'procesos')
  OR public.has_role(auth.uid(), 'integridad_datos')
  OR public.has_role(auth.uid(), 'ejecutor')
  OR public.has_role(auth.uid(), 'administrador')
);

-- Update requests DELETE policy
DROP POLICY IF EXISTS "Users can delete draft requests" ON public.requests;
CREATE POLICY "Users can delete draft requests"
ON public.requests FOR DELETE
USING (
  status = 'borrador' AND (
    created_by = auth.uid()
    OR public.has_role(auth.uid(), 'revisor')
    OR public.has_role(auth.uid(), 'gerencia')
    OR public.has_role(auth.uid(), 'procesos')
    OR public.has_role(auth.uid(), 'integridad_datos')
    OR public.has_role(auth.uid(), 'administrador')
  )
);

-- Update get_notifiable_users
CREATE OR REPLACE FUNCTION public.get_notifiable_users(_request_id uuid, _exclude_user_id uuid DEFAULT NULL)
RETURNS TABLE(user_id uuid, user_email text, user_name text, user_role text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT p.id, p.email, p.name, 'solicitante'::text
  FROM requests r
  JOIN profiles p ON p.id = r.created_by
  WHERE r.id = _request_id
    AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  UNION
  SELECT DISTINCT p.id, p.email, p.name, 'gerencia'::text
  FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'gerencia' AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  UNION
  SELECT DISTINCT p.id, p.email, p.name, 'procesos'::text
  FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'procesos' AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  UNION
  SELECT DISTINCT p.id, p.email, p.name, 'integridad_datos'::text
  FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'integridad_datos' AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  UNION
  SELECT DISTINCT p.id, p.email, p.name, 'ejecutor'::text
  FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'ejecutor' AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
  UNION
  SELECT DISTINCT p.id, p.email, p.name, 'administrador'::text
  FROM user_roles ur JOIN profiles p ON p.id = ur.user_id
  WHERE ur.role = 'administrador' AND (_exclude_user_id IS NULL OR p.id != _exclude_user_id)
$$;

-- Update history delete policy
DROP POLICY IF EXISTS "Users can delete history of draft requests" ON public.request_status_history;
CREATE POLICY "Users can delete history of draft requests"
ON public.request_status_history FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_status_history.request_id
    AND r.status = 'borrador'
    AND (
      r.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'revisor')
      OR public.has_role(auth.uid(), 'gerencia')
      OR public.has_role(auth.uid(), 'procesos')
      OR public.has_role(auth.uid(), 'integridad_datos')
      OR public.has_role(auth.uid(), 'administrador')
    )
  )
);

-- Update items delete policy
DROP POLICY IF EXISTS "Users can delete items of draft requests" ON public.request_items;
CREATE POLICY "Users can delete items of draft requests"
ON public.request_items FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_items.request_id
    AND r.status = 'borrador'
    AND (
      r.created_by = auth.uid()
      OR public.has_role(auth.uid(), 'revisor')
      OR public.has_role(auth.uid(), 'gerencia')
      OR public.has_role(auth.uid(), 'procesos')
      OR public.has_role(auth.uid(), 'integridad_datos')
      OR public.has_role(auth.uid(), 'administrador')
    )
  )
);
