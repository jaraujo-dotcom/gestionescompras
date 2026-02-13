
-- 1. Add sequential request number
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS request_number integer;

-- Create sequence for request numbers
CREATE SEQUENCE IF NOT EXISTS public.request_number_seq START WITH 1 INCREMENT BY 1;

-- Set existing requests with sequential numbers
DO $$
DECLARE
  r RECORD;
  counter integer := 0;
BEGIN
  FOR r IN SELECT id FROM public.requests ORDER BY created_at ASC LOOP
    counter := counter + 1;
    UPDATE public.requests SET request_number = counter WHERE id = r.id;
  END LOOP;
  IF counter > 0 THEN
    PERFORM setval('public.request_number_seq', counter);
  END IF;
END $$;

-- Set default for new requests
ALTER TABLE public.requests ALTER COLUMN request_number SET DEFAULT nextval('public.request_number_seq');

-- Make it unique and not null
ALTER TABLE public.requests ALTER COLUMN request_number SET NOT NULL;
ALTER TABLE public.requests ADD CONSTRAINT requests_request_number_unique UNIQUE (request_number);

-- 2. Create request_comments table for follow-up tracking
CREATE TABLE public.request_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id uuid NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  comment text NOT NULL CHECK (char_length(comment) <= 2000),
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.request_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request comments"
ON public.request_comments FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = request_comments.request_id
    AND can_view_request(auth.uid(), r.id)
  )
);

CREATE POLICY "Users can insert request comments"
ON public.request_comments FOR INSERT
WITH CHECK (
  user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = request_comments.request_id
    AND can_view_request(auth.uid(), r.id)
  )
);

CREATE POLICY "Users can delete own comments"
ON public.request_comments FOR DELETE
USING (user_id = auth.uid());

-- 3. Update can_view_request to include en_espera
CREATE OR REPLACE FUNCTION public.can_view_request(_user_id uuid, _request_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
    AND (
      r.created_by = _user_id
      OR (public.has_role(_user_id, 'revisor') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'ejecutor') AND r.status IN ('aprobada', 'en_ejecucion', 'en_espera'))
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;
