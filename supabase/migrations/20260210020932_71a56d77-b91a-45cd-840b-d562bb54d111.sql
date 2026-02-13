
-- Add 'anulada' status to the enum
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'anulada';

-- Allow DELETE on requests in 'borrador' by creator, revisor, or admin
CREATE POLICY "Users can delete draft requests"
ON public.requests
FOR DELETE
USING (
  status = 'borrador'
  AND (
    created_by = auth.uid()
    OR has_role(auth.uid(), 'revisor'::app_role)
    OR has_role(auth.uid(), 'administrador'::app_role)
  )
);

-- Also allow deleting related request_items when request is deleted
CREATE POLICY "Users can delete items of draft requests"
ON public.request_items
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_items.request_id
    AND r.status = 'borrador'
    AND (
      r.created_by = auth.uid()
      OR has_role(auth.uid(), 'revisor'::app_role)
      OR has_role(auth.uid(), 'administrador'::app_role)
    )
  )
);

-- Allow deleting status history of draft requests (cleanup)
CREATE POLICY "Users can delete history of draft requests"
ON public.request_status_history
FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM requests r
    WHERE r.id = request_status_history.request_id
    AND r.status = 'borrador'
    AND (
      r.created_by = auth.uid()
      OR has_role(auth.uid(), 'revisor'::app_role)
      OR has_role(auth.uid(), 'administrador'::app_role)
    )
  )
);
