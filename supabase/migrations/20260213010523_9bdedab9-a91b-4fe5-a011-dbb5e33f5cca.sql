
-- Notification events: both system and custom events
CREATE TABLE public.notification_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_key text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  is_system boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification_events"
  ON public.notification_events FOR ALL
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Authenticated can read notification_events"
  ON public.notification_events FOR SELECT
  USING (auth.role() = 'authenticated');

-- Notification configs: per-event config with templates
CREATE TABLE public.notification_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.notification_events(id) ON DELETE CASCADE UNIQUE,
  target_roles text[] NOT NULL DEFAULT '{}',
  include_creator boolean NOT NULL DEFAULT true,
  channel_inapp boolean NOT NULL DEFAULT true,
  channel_email boolean NOT NULL DEFAULT true,
  inapp_title_template text NOT NULL DEFAULT '',
  inapp_body_template text NOT NULL DEFAULT '',
  email_subject_template text NOT NULL DEFAULT '',
  email_body_template text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can manage notification_configs"
  ON public.notification_configs FOR ALL
  USING (public.has_role(auth.uid(), 'administrador'));

CREATE POLICY "Authenticated can read notification_configs"
  ON public.notification_configs FOR SELECT
  USING (auth.role() = 'authenticated');

-- Trigger for updated_at
CREATE TRIGGER update_notification_events_updated_at
  BEFORE UPDATE ON public.notification_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_notification_configs_updated_at
  BEFORE UPDATE ON public.notification_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed system events
INSERT INTO public.notification_events (event_key, name, description, is_system) VALUES
  ('status_change', 'Cambio de estado', 'Se notifica cuando una solicitud cambia de estado', true),
  ('new_comment', 'Nuevo comentario', 'Se notifica cuando se agrega un comentario a una solicitud', true),
  ('assignment', 'Asignación', 'Se notifica cuando se asigna una solicitud', true);

-- Seed default configs for system events
INSERT INTO public.notification_configs (event_id, target_roles, include_creator, channel_inapp, channel_email, inapp_title_template, inapp_body_template, email_subject_template, email_body_template)
SELECT 
  e.id,
  ARRAY['revisor','ejecutor','administrador'],
  true,
  true,
  true,
  '{{template_name}} Solicitud #{{request_number}}: {{new_status}}',
  '{{user_name}} cambió el estado de "{{request_title}}" a {{new_status}}.',
  '[{{template_name}}] Solicitud #{{request_number}}: {{new_status}}',
  '<p>{{user_name}} cambió el estado de <strong>"{{request_title}}"</strong>.</p><p>Nuevo estado: <strong>{{new_status}}</strong></p><p>{{comment}}</p><p><a href="{{request_url}}">Ver solicitud</a></p>'
FROM public.notification_events e WHERE e.event_key = 'status_change';

INSERT INTO public.notification_configs (event_id, target_roles, include_creator, channel_inapp, channel_email, inapp_title_template, inapp_body_template, email_subject_template, email_body_template)
SELECT 
  e.id,
  ARRAY['revisor','ejecutor','administrador'],
  true,
  true,
  true,
  'Nuevo comentario en Solicitud #{{request_number}}',
  '{{user_name}} comentó en "{{request_title}}": {{comment}}',
  'Nuevo comentario - Solicitud #{{request_number}}',
  '<p>{{user_name}} comentó en <strong>"{{request_title}}"</strong>:</p><blockquote>{{comment}}</blockquote><p><a href="{{request_url}}">Ver solicitud</a></p>'
FROM public.notification_events e WHERE e.event_key = 'new_comment';

INSERT INTO public.notification_configs (event_id, target_roles, include_creator, channel_inapp, channel_email, inapp_title_template, inapp_body_template, email_subject_template, email_body_template)
SELECT 
  e.id,
  ARRAY['revisor','ejecutor','administrador'],
  true,
  true,
  true,
  'Asignación - Solicitud #{{request_number}}',
  'Se te ha asignado la solicitud "{{request_title}}".',
  'Asignación - Solicitud #{{request_number}}',
  '<p>Se te ha asignado la solicitud <strong>"{{request_title}}"</strong>.</p><p><a href="{{request_url}}">Ver solicitud</a></p>'
FROM public.notification_events e WHERE e.event_key = 'assignment';
