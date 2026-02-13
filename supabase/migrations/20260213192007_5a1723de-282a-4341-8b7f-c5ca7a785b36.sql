
-- Create groups table
CREATE TABLE public.groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- Create user_groups junction table
CREATE TABLE public.user_groups (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, group_id)
);

ALTER TABLE public.user_groups ENABLE ROW LEVEL SECURITY;

-- Add group_id to requests
ALTER TABLE public.requests ADD COLUMN group_id UUID REFERENCES public.groups(id) ON DELETE SET NULL;

-- Trigger for groups updated_at
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON public.groups
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Helper function: check if user belongs to a group
CREATE OR REPLACE FUNCTION public.user_in_group(_user_id UUID, _group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_groups
    WHERE user_id = _user_id AND group_id = _group_id
  )
$$;

-- Helper function: get user group ids
CREATE OR REPLACE FUNCTION public.get_user_group_ids(_user_id UUID)
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(ARRAY_AGG(group_id), '{}')
  FROM public.user_groups
  WHERE user_id = _user_id
$$;

-- RLS for groups: everyone authenticated can read, admins can manage
CREATE POLICY "Authenticated can read groups"
  ON public.groups FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage groups"
  ON public.groups FOR ALL
  USING (has_role(auth.uid(), 'administrador'))
  WITH CHECK (has_role(auth.uid(), 'administrador'));

-- RLS for user_groups: users see own, admins manage all
CREATE POLICY "Users can view own group memberships"
  ON public.user_groups FOR SELECT
  USING (user_id = auth.uid() OR has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can manage user_groups"
  ON public.user_groups FOR ALL
  USING (has_role(auth.uid(), 'administrador'))
  WITH CHECK (has_role(auth.uid(), 'administrador'));

-- Update can_view_request to include group-based visibility
CREATE OR REPLACE FUNCTION public.can_view_request(_user_id uuid, _request_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
    AND (
      r.created_by = _user_id
      -- Group-based: user can see requests from their group
      OR (r.group_id IS NOT NULL AND public.user_in_group(_user_id, r.group_id))
      OR (public.has_role(_user_id, 'revisor') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'gerencia') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'procesos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'integridad_datos') AND r.status IN ('en_revision', 'aprobada', 'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'devuelta', 'anulada'))
      OR (public.has_role(_user_id, 'ejecutor') AND r.status IN ('aprobada', 'en_ejecucion', 'en_espera', 'completada', 'anulada'))
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;
