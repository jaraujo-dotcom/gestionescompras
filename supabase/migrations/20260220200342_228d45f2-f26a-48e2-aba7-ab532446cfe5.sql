
-- Fix overly permissive UPDATE policy on request_workflow_steps
DROP POLICY "Update Request Steps" ON public.request_workflow_steps;

CREATE POLICY "Authorized users can update workflow steps"
ON public.request_workflow_steps
FOR UPDATE
USING (
  -- User has the role matching this step's role_name
  has_role(auth.uid(), role_name::app_role)
  -- Or user is an admin
  OR has_role(auth.uid(), 'administrador'::app_role)
)
WITH CHECK (
  has_role(auth.uid(), role_name::app_role)
  OR has_role(auth.uid(), 'administrador'::app_role)
);
