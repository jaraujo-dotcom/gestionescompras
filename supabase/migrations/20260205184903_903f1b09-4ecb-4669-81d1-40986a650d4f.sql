-- Fix form_fields RLS policies to be permissive
DROP POLICY IF EXISTS "Admins can manage form_fields" ON public.form_fields;
DROP POLICY IF EXISTS "Anyone can view form_fields" ON public.form_fields;

-- Create permissive policies
CREATE POLICY "Anyone can view form_fields" 
ON public.form_fields 
FOR SELECT 
USING (true);

CREATE POLICY "Admins can manage form_fields" 
ON public.form_fields 
FOR ALL 
USING (has_role(auth.uid(), 'administrador'))
WITH CHECK (has_role(auth.uid(), 'administrador'));

-- Also fix form_templates policies
DROP POLICY IF EXISTS "Admins can insert templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admins can update templates" ON public.form_templates;
DROP POLICY IF EXISTS "Admins can delete templates" ON public.form_templates;
DROP POLICY IF EXISTS "Anyone can view active templates" ON public.form_templates;

CREATE POLICY "Anyone can view active templates" 
ON public.form_templates 
FOR SELECT 
USING (is_active = true OR has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can insert templates" 
ON public.form_templates 
FOR INSERT 
WITH CHECK (has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update templates" 
ON public.form_templates 
FOR UPDATE 
USING (has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete templates" 
ON public.form_templates 
FOR DELETE 
USING (has_role(auth.uid(), 'administrador'));