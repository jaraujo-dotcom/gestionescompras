
-- Allow admins to insert approvals for any role
DROP POLICY IF EXISTS "Approvers can insert approvals" ON public.request_approvals;
CREATE POLICY "Approvers can insert approvals"
ON public.request_approvals FOR INSERT
WITH CHECK (
  approved_by = auth.uid() AND
  (
    (role = 'gerencia' AND (public.has_role(auth.uid(), 'gerencia') OR public.has_role(auth.uid(), 'administrador'))) OR
    (role = 'procesos' AND (public.has_role(auth.uid(), 'procesos') OR public.has_role(auth.uid(), 'administrador'))) OR
    (role = 'integridad_datos' AND (public.has_role(auth.uid(), 'integridad_datos') OR public.has_role(auth.uid(), 'administrador')))
  )
);
