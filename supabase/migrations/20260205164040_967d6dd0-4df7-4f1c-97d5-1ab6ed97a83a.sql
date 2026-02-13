-- =============================================
-- SISTEMA DE SOLICITUDES DE ARTÍCULOS - MVP
-- =============================================

-- 1. Crear enum para roles
CREATE TYPE public.app_role AS ENUM ('solicitante', 'revisor', 'ejecutor', 'administrador');

-- 2. Crear enum para estados de solicitud
CREATE TYPE public.request_status AS ENUM (
  'borrador',
  'en_revision',
  'devuelta',
  'aprobada',
  'en_ejecucion',
  'completada',
  'rechazada'
);

-- 3. Crear enum para tipos de campo de formulario
CREATE TYPE public.field_type AS ENUM ('text', 'number', 'date', 'select', 'boolean', 'table');

-- 4. Tabla de perfiles de usuario
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. Tabla de roles de usuario (RBAC)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);

-- 6. Tabla de plantillas de formulario
CREATE TABLE public.form_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 7. Tabla de campos de formulario
CREATE TABLE public.form_fields (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.form_templates(id) ON DELETE CASCADE,
  field_key TEXT NOT NULL,
  label TEXT NOT NULL,
  field_type field_type NOT NULL,
  is_required BOOLEAN NOT NULL DEFAULT false,
  placeholder TEXT,
  options_json JSONB, -- Para select: ["opcion1", "opcion2"]
  table_schema_json JSONB, -- Para table: [{name, type, required}]
  dependency_json JSONB, -- {fieldKey, operator, value, effect}
  field_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 8. Tabla de solicitudes
CREATE TABLE public.requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID REFERENCES public.form_templates(id) ON DELETE SET NULL,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status request_status NOT NULL DEFAULT 'borrador',
  title TEXT NOT NULL,
  data_json JSONB NOT NULL DEFAULT '{}', -- Datos de campos dinámicos
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 9. Tabla de artículos de solicitud
CREATE TABLE public.request_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  codigo_interno TEXT,
  nombre_articulo TEXT NOT NULL,
  categoria TEXT NOT NULL,
  unidad_medida TEXT NOT NULL,
  cantidad INTEGER NOT NULL DEFAULT 1,
  precio_estimado DECIMAL(12,2),
  observaciones TEXT,
  item_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 10. Tabla de historial de estados
CREATE TABLE public.request_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID NOT NULL REFERENCES public.requests(id) ON DELETE CASCADE,
  from_status request_status,
  to_status request_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================
-- FUNCIONES DE SEGURIDAD
-- =============================================

-- Función para verificar si un usuario tiene un rol específico
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Función para obtener todos los roles de un usuario
CREATE OR REPLACE FUNCTION public.get_user_roles(_user_id UUID)
RETURNS app_role[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY_AGG(role)
  FROM public.user_roles
  WHERE user_id = _user_id
$$;

-- Función para verificar si el usuario puede ver una solicitud
CREATE OR REPLACE FUNCTION public.can_view_request(_user_id UUID, _request_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.requests r
    WHERE r.id = _request_id
    AND (
      -- El creador siempre puede ver su solicitud
      r.created_by = _user_id
      -- Revisores pueden ver solicitudes en revisión
      OR (public.has_role(_user_id, 'revisor') AND r.status = 'en_revision')
      -- Ejecutores pueden ver aprobadas y en ejecución
      OR (public.has_role(_user_id, 'ejecutor') AND r.status IN ('aprobada', 'en_ejecucion'))
      -- Administradores pueden ver todo
      OR public.has_role(_user_id, 'administrador')
    )
  )
$$;

-- =============================================
-- POLÍTICAS RLS
-- =============================================

-- Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

-- User Roles (solo admin puede modificar)
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can insert user_roles"
  ON public.user_roles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete user_roles"
  ON public.user_roles FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- Form Templates (admin puede modificar, todos pueden ver activas)
ALTER TABLE public.form_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active templates"
  ON public.form_templates FOR SELECT
  TO authenticated
  USING (is_active = true OR public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can insert templates"
  ON public.form_templates FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can update templates"
  ON public.form_templates FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Admins can delete templates"
  ON public.form_templates FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- Form Fields
ALTER TABLE public.form_fields ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view form_fields"
  ON public.form_fields FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage form_fields"
  ON public.form_fields FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'administrador'));

-- Requests
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view accessible requests"
  ON public.requests FOR SELECT
  TO authenticated
  USING (public.can_view_request(auth.uid(), id));

CREATE POLICY "Solicitantes can create requests"
  ON public.requests FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid() 
    AND public.has_role(auth.uid(), 'solicitante')
  );

CREATE POLICY "Users can update own draft/returned requests"
  ON public.requests FOR UPDATE
  TO authenticated
  USING (
    (created_by = auth.uid() AND status IN ('borrador', 'devuelta'))
    OR public.has_role(auth.uid(), 'revisor')
    OR public.has_role(auth.uid(), 'ejecutor')
    OR public.has_role(auth.uid(), 'administrador')
  );

-- Request Items
ALTER TABLE public.request_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request items"
  ON public.request_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
      AND public.can_view_request(auth.uid(), r.id)
    )
  );

CREATE POLICY "Users can manage own request items"
  ON public.request_items FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
      AND r.created_by = auth.uid()
      AND r.status IN ('borrador', 'devuelta')
    )
  );

-- Request Status History
ALTER TABLE public.request_status_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view request history"
  ON public.request_status_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.requests r
      WHERE r.id = request_id
      AND public.can_view_request(auth.uid(), r.id)
    )
  );

CREATE POLICY "Users can insert status history"
  ON public.request_status_history FOR INSERT
  TO authenticated
  WITH CHECK (changed_by = auth.uid());

-- =============================================
-- TRIGGERS
-- =============================================

-- Trigger para actualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_form_templates_updated_at
  BEFORE UPDATE ON public.form_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_form_fields_updated_at
  BEFORE UPDATE ON public.form_fields
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_requests_updated_at
  BEFORE UPDATE ON public.requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger para crear perfil automáticamente al registrarse
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();