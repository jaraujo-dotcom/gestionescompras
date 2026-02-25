
-- 1. Add 'esperando_tercero' to request_status enum
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'esperando_tercero';

-- 2. Add is_external column to form_fields
ALTER TABLE public.form_fields ADD COLUMN IF NOT EXISTS is_external boolean NOT NULL DEFAULT false;

-- 3. Create external_invitations table
CREATE TABLE public.external_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  expires_at timestamptz NOT NULL,
  guest_name text,
  guest_email text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

-- 4. Enable RLS
ALTER TABLE public.external_invitations ENABLE ROW LEVEL SECURITY;

-- 5. RLS: creators and admins can read
CREATE POLICY "Creators and admins can read invitations"
ON public.external_invitations
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'administrador'::app_role)
);

-- 6. RLS: creators can insert
CREATE POLICY "Authenticated users can create invitations"
ON public.external_invitations
FOR INSERT
TO authenticated
WITH CHECK (
  created_by = auth.uid() AND (
    has_role(auth.uid(), 'solicitante'::app_role) OR has_role(auth.uid(), 'administrador'::app_role)
  )
);

-- 7. RLS: creators and admins can update
CREATE POLICY "Creators and admins can update invitations"
ON public.external_invitations
FOR UPDATE
TO authenticated
USING (
  created_by = auth.uid() OR has_role(auth.uid(), 'administrador'::app_role)
);

-- 8. Validation trigger for status
CREATE OR REPLACE FUNCTION public.validate_invitation_status()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status NOT IN ('pending', 'completed', 'expired') THEN
    RAISE EXCEPTION 'Invalid invitation status: %', NEW.status;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER validate_invitation_status_trigger
  BEFORE INSERT OR UPDATE ON public.external_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_invitation_status();
