
-- Drop and recreate INSERT policy with TO authenticated
DROP POLICY IF EXISTS "Solicitantes can create requests" ON public.requests;

CREATE POLICY "Solicitantes can create requests"
ON public.requests
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND has_role(auth.uid(), 'solicitante'::app_role)
);
