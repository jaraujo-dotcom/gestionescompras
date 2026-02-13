
DROP POLICY "Solicitantes can create requests" ON public.requests;

CREATE POLICY "Users can create requests"
ON public.requests
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND (
    has_role(auth.uid(), 'solicitante'::app_role)
    OR has_role(auth.uid(), 'administrador'::app_role)
  )
);
