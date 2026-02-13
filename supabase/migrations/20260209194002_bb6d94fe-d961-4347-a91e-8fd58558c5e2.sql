
-- ============================================================
-- FIX 1: Restrict profiles SELECT to own profile or admin
-- ============================================================
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Users can only see their own profile
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR has_role(auth.uid(), 'administrador'::app_role));

-- Create a SECURITY DEFINER function to get profile names by IDs (for history display)
CREATE OR REPLACE FUNCTION public.get_profiles_by_ids(_ids uuid[])
RETURNS TABLE(id uuid, name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.name
  FROM public.profiles p
  WHERE p.id = ANY(_ids);
$$;

-- ============================================================
-- FIX 2: Restrict user_roles SELECT to own roles or admin
-- ============================================================
DROP POLICY IF EXISTS "Anyone can view user_roles" ON public.user_roles;

CREATE POLICY "Users can view own roles or admin can view all"
  ON public.user_roles FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'administrador'::app_role));

-- ============================================================
-- FIX 3: Input validation via CHECK constraints
-- ============================================================
-- Limit text field lengths at the database level
ALTER TABLE public.requests
  ADD CONSTRAINT chk_requests_title_length CHECK (char_length(title) <= 500);

ALTER TABLE public.form_templates
  ADD CONSTRAINT chk_templates_name_length CHECK (char_length(name) <= 200),
  ADD CONSTRAINT chk_templates_description_length CHECK (char_length(description) <= 2000);

ALTER TABLE public.form_fields
  ADD CONSTRAINT chk_fields_label_length CHECK (char_length(label) <= 200),
  ADD CONSTRAINT chk_fields_key_length CHECK (char_length(field_key) <= 100),
  ADD CONSTRAINT chk_fields_placeholder_length CHECK (char_length(placeholder) <= 500);

ALTER TABLE public.request_status_history
  ADD CONSTRAINT chk_history_comment_length CHECK (char_length(comment) <= 2000);

ALTER TABLE public.request_items
  ADD CONSTRAINT chk_items_nombre_length CHECK (char_length(nombre_articulo) <= 500),
  ADD CONSTRAINT chk_items_categoria_length CHECK (char_length(categoria) <= 200),
  ADD CONSTRAINT chk_items_observaciones_length CHECK (char_length(observaciones) <= 2000);

ALTER TABLE public.profiles
  ADD CONSTRAINT chk_profiles_name_length CHECK (char_length(name) <= 200),
  ADD CONSTRAINT chk_profiles_email_length CHECK (char_length(email) <= 255);
