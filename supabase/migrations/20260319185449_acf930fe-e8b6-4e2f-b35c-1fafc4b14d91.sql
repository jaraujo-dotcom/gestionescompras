
-- Many-to-many: form templates linked to groups
CREATE TABLE public.form_template_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (template_id, group_id)
);

ALTER TABLE public.form_template_groups ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read (needed to filter templates)
CREATE POLICY "Authenticated can read form_template_groups"
  ON public.form_template_groups FOR SELECT
  TO authenticated
  USING (true);

-- Admins can manage
CREATE POLICY "Admins can manage form_template_groups"
  ON public.form_template_groups FOR ALL
  TO public
  USING (has_role(auth.uid(), 'administrador'::app_role))
  WITH CHECK (has_role(auth.uid(), 'administrador'::app_role));
