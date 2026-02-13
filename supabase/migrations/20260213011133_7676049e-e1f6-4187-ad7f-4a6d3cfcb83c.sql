
-- Remove generic status_change event (cascade deletes its config)
DELETE FROM public.notification_events WHERE event_key = 'status_change';

-- Insert per-status events
INSERT INTO public.notification_events (event_key, name, description, is_system) VALUES
  ('status_to_en_revision', 'Enviada a Revisión', 'Cuando una solicitud pasa a estado En Revisión', true),
  ('status_to_aprobada', 'Aprobada', 'Cuando una solicitud es aprobada', true),
  ('status_to_devuelta', 'Devuelta', 'Cuando una solicitud es devuelta al solicitante', true),
  ('status_to_rechazada', 'Rechazada', 'Cuando una solicitud es rechazada', true),
  ('status_to_en_ejecucion', 'En Ejecución', 'Cuando una solicitud pasa a ejecución', true),
  ('status_to_en_espera', 'En Espera', 'Cuando una solicitud se pone en espera', true),
  ('status_to_completada', 'Completada', 'Cuando una solicitud se marca como completada', true),
  ('status_to_anulada', 'Anulada', 'Cuando una solicitud es anulada', true);

-- Create default configs for each
INSERT INTO public.notification_configs (event_id, target_roles, include_creator, channel_inapp, channel_email, inapp_title_template, inapp_body_template, email_subject_template, email_body_template)
SELECT e.id,
  ARRAY['revisor','ejecutor','administrador'],
  true, true, true,
  '[{{template_name}}] Solicitud #{{request_number}}: ' || 
    CASE e.event_key
      WHEN 'status_to_en_revision' THEN 'En Revisión'
      WHEN 'status_to_aprobada' THEN 'Aprobada'
      WHEN 'status_to_devuelta' THEN 'Devuelta'
      WHEN 'status_to_rechazada' THEN 'Rechazada'
      WHEN 'status_to_en_ejecucion' THEN 'En Ejecución'
      WHEN 'status_to_en_espera' THEN 'En Espera'
      WHEN 'status_to_completada' THEN 'Completada'
      WHEN 'status_to_anulada' THEN 'Anulada'
    END,
  '{{user_name}} cambió el estado de "{{request_title}}" a ' ||
    CASE e.event_key
      WHEN 'status_to_en_revision' THEN 'En Revisión'
      WHEN 'status_to_aprobada' THEN 'Aprobada'
      WHEN 'status_to_devuelta' THEN 'Devuelta'
      WHEN 'status_to_rechazada' THEN 'Rechazada'
      WHEN 'status_to_en_ejecucion' THEN 'En Ejecución'
      WHEN 'status_to_en_espera' THEN 'En Espera'
      WHEN 'status_to_completada' THEN 'Completada'
      WHEN 'status_to_anulada' THEN 'Anulada'
    END || '. {{comment}}',
  '[{{template_name}}] Solicitud #{{request_number}}: ' ||
    CASE e.event_key
      WHEN 'status_to_en_revision' THEN 'En Revisión'
      WHEN 'status_to_aprobada' THEN 'Aprobada'
      WHEN 'status_to_devuelta' THEN 'Devuelta'
      WHEN 'status_to_rechazada' THEN 'Rechazada'
      WHEN 'status_to_en_ejecucion' THEN 'En Ejecución'
      WHEN 'status_to_en_espera' THEN 'En Espera'
      WHEN 'status_to_completada' THEN 'Completada'
      WHEN 'status_to_anulada' THEN 'Anulada'
    END,
  '<p>{{user_name}} cambió el estado de <strong>"{{request_title}}"</strong>.</p><p>Nuevo estado: <strong>' ||
    CASE e.event_key
      WHEN 'status_to_en_revision' THEN 'En Revisión'
      WHEN 'status_to_aprobada' THEN 'Aprobada'
      WHEN 'status_to_devuelta' THEN 'Devuelta'
      WHEN 'status_to_rechazada' THEN 'Rechazada'
      WHEN 'status_to_en_ejecucion' THEN 'En Ejecución'
      WHEN 'status_to_en_espera' THEN 'En Espera'
      WHEN 'status_to_completada' THEN 'Completada'
      WHEN 'status_to_anulada' THEN 'Anulada'
    END || '</strong></p><p>{{comment}}</p><p><a href="{{request_url}}">Ver solicitud</a></p>'
FROM public.notification_events e
WHERE e.event_key LIKE 'status_to_%';
