
-- Create form_sections table
CREATE TABLE public.form_sections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  section_order INT NOT NULL DEFAULT 0,
  is_collapsible BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.form_sections ENABLE ROW LEVEL SECURITY;

-- Policies: same as form_fields (admins can manage, authenticated can read)
CREATE POLICY "Authenticated users can read form_sections"
  ON public.form_sections FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage form_sections"
  ON public.form_sections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'administrador'
    )
  );

-- Add section_id to form_fields
ALTER TABLE public.form_fields
  ADD COLUMN section_id UUID REFERENCES public.form_sections(id) ON DELETE SET NULL;

-- Create index
CREATE INDEX idx_form_sections_template ON public.form_sections(template_id);
CREATE INDEX idx_form_fields_section ON public.form_fields(section_id);
