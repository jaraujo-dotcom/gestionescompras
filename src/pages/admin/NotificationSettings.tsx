import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { toast } from 'sonner';
import {
  Bell,
  Plus,
  Trash2,
  Loader2,
  Mail,
  BellRing,
  Info,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface NotificationEvent {
  id: string;
  event_key: string;
  name: string;
  description: string | null;
  is_system: boolean;
  is_active: boolean;
}

interface NotificationConfig {
  id: string;
  event_id: string;
  target_roles: string[];
  include_creator: boolean;
  channel_inapp: boolean;
  channel_email: boolean;
  inapp_title_template: string;
  inapp_body_template: string;
  email_subject_template: string;
  email_body_template: string;
}

const ALL_ROLES = [
  { value: 'solicitante', label: 'Solicitante' },
  { value: 'gerencia', label: 'Gerencia' },
  { value: 'procesos', label: 'Procesos' },
  { value: 'integridad_datos', label: 'Integridad de Datos' },
  { value: 'ejecutor', label: 'Ejecutor' },
  { value: 'administrador', label: 'Administrador' },
];

const TEMPLATE_VARIABLES = [
  { var: '{{user_name}}', desc: 'Nombre del usuario que ejecutó la acción' },
  { var: '{{request_title}}', desc: 'Título de la solicitud' },
  { var: '{{request_number}}', desc: 'Número de solicitud (6 dígitos)' },
  { var: '{{template_name}}', desc: 'Nombre de la plantilla de formulario' },
  { var: '{{new_status}}', desc: 'Nuevo estado de la solicitud' },
  { var: '{{comment}}', desc: 'Comentario o nota del cambio' },
  { var: '{{request_url}}', desc: 'Enlace directo a la solicitud' },
];

interface EventAccordionItemProps {
  event: NotificationEvent;
  config: NotificationConfig | undefined;
  onToggleActive: (event: NotificationEvent) => void;
  onToggleRole: (eventId: string, role: string) => void;
  onUpdateConfig: (eventId: string, partial: Partial<NotificationConfig>) => void;
  onSave: (eventId: string) => void;
  onDelete: (event: NotificationEvent) => void;
  saving: string | null;
}

function EventAccordionItem({ event, config, onToggleActive, onToggleRole, onUpdateConfig, onSave, onDelete, saving }: EventAccordionItemProps) {
  return (
    <AccordionItem value={event.id} className="border rounded-lg">
      <AccordionTrigger className="px-4 py-3 hover:no-underline">
        <div className="flex items-center gap-3 flex-1 text-left">
          <Switch
            checked={event.is_active}
            onCheckedChange={() => onToggleActive(event)}
            onClick={(e) => e.stopPropagation()}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium">{event.name}</span>
              {event.is_system && <Badge variant="secondary" className="text-xs">Sistema</Badge>}
              {!event.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inactivo</Badge>}
            </div>
            {event.description && <p className="text-sm text-muted-foreground truncate">{event.description}</p>}
          </div>
          <code className="text-xs bg-muted px-2 py-0.5 rounded hidden sm:block">{event.event_key}</code>
        </div>
      </AccordionTrigger>
      <AccordionContent className="px-4 pb-4">
        {config ? (
          <div className="space-y-6 pt-2">
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Destinatarios</Label>
              <div className="flex flex-wrap gap-3">
                {ALL_ROLES.map((role) => (
                  <label key={role.value} className="flex items-center gap-2 cursor-pointer">
                    <Checkbox checked={config.target_roles.includes(role.value)} onCheckedChange={() => onToggleRole(event.id, role.value)} />
                    <span className="text-sm">{role.label}</span>
                  </label>
                ))}
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={config.include_creator} onCheckedChange={(checked) => onUpdateConfig(event.id, { include_creator: !!checked })} />
                <span className="text-sm">Incluir al creador de la solicitud</span>
              </label>
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-semibold">Canales</Label>
              <div className="flex gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={config.channel_inapp} onCheckedChange={(checked) => onUpdateConfig(event.id, { channel_inapp: checked })} />
                  <BellRing className="w-4 h-4 text-muted-foreground" /><span className="text-sm">In-App</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch checked={config.channel_email} onCheckedChange={(checked) => onUpdateConfig(event.id, { channel_email: checked })} />
                  <Mail className="w-4 h-4 text-muted-foreground" /><span className="text-sm">Email</span>
                </label>
              </div>
            </div>
            {config.channel_inapp && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2"><BellRing className="w-4 h-4" /> Plantilla In-App</Label>
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Título</Label>
                    <Input value={config.inapp_title_template} onChange={(e) => onUpdateConfig(event.id, { inapp_title_template: e.target.value })} placeholder="{{template_name}} Solicitud #{{request_number}}" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cuerpo</Label>
                    <Textarea value={config.inapp_body_template} onChange={(e) => onUpdateConfig(event.id, { inapp_body_template: e.target.value })} placeholder="{{user_name}} cambió el estado de..." rows={2} />
                  </div>
                </div>
              </div>
            )}
            {config.channel_email && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2"><Mail className="w-4 h-4" /> Plantilla Email</Label>
                <div className="grid gap-3">
                  <div>
                    <Label className="text-xs text-muted-foreground">Asunto</Label>
                    <Input value={config.email_subject_template} onChange={(e) => onUpdateConfig(event.id, { email_subject_template: e.target.value })} placeholder="[{{template_name}}] Solicitud #{{request_number}}" />
                  </div>
                  <div>
                    <Label className="text-xs text-muted-foreground">Cuerpo (HTML permitido)</Label>
                    <Textarea value={config.email_body_template} onChange={(e) => onUpdateConfig(event.id, { email_body_template: e.target.value })} placeholder="<p>{{user_name}} cambió el estado...</p>" rows={5} className="font-mono text-xs" />
                  </div>
                </div>
              </div>
            )}
            <div className="flex items-center justify-between pt-2 border-t">
              <div>
                {!event.is_system && (
                  <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => onDelete(event)}>
                    <Trash2 className="w-4 h-4 mr-1" /> Eliminar evento
                  </Button>
                )}
              </div>
              <Button size="sm" onClick={() => onSave(event.id)} disabled={saving === event.id}>
                {saving === event.id ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
                Guardar
              </Button>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-2">Sin configuración.</p>
        )}
      </AccordionContent>
    </AccordionItem>
  );
}

export default function NotificationSettings() {
  const { hasRole } = useAuth();
  const [events, setEvents] = useState<NotificationEvent[]>([]);
  const [configs, setConfigs] = useState<Record<string, NotificationConfig>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [showNewEvent, setShowNewEvent] = useState(false);
  const [newEvent, setNewEvent] = useState({ name: '', description: '', event_key: '' });
  const [showVars, setShowVars] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [{ data: evts }, { data: cfgs }] = await Promise.all([
      supabase.from('notification_events').select('*').order('is_system', { ascending: false }).order('name'),
      supabase.from('notification_configs').select('*'),
    ]);

    setEvents((evts as NotificationEvent[]) || []);
    const configMap: Record<string, NotificationConfig> = {};
    (cfgs as NotificationConfig[] || []).forEach((c) => {
      configMap[c.event_id] = c;
    });
    setConfigs(configMap);
    setLoading(false);
  };

  const toggleActive = async (event: NotificationEvent) => {
    const { error } = await supabase
      .from('notification_events')
      .update({ is_active: !event.is_active })
      .eq('id', event.id);
    if (error) {
      toast.error('Error al actualizar');
    } else {
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? { ...e, is_active: !e.is_active } : e))
      );
    }
  };

  const updateConfig = (eventId: string, partial: Partial<NotificationConfig>) => {
    setConfigs((prev) => ({
      ...prev,
      [eventId]: { ...prev[eventId], ...partial },
    }));
  };

  const toggleRole = (eventId: string, role: string) => {
    const config = configs[eventId];
    if (!config) return;
    const roles = config.target_roles.includes(role)
      ? config.target_roles.filter((r) => r !== role)
      : [...config.target_roles, role];
    updateConfig(eventId, { target_roles: roles });
  };

  const saveConfig = async (eventId: string) => {
    const config = configs[eventId];
    if (!config) return;
    setSaving(eventId);
    const { error } = await supabase
      .from('notification_configs')
      .update({
        target_roles: config.target_roles,
        include_creator: config.include_creator,
        channel_inapp: config.channel_inapp,
        channel_email: config.channel_email,
        inapp_title_template: config.inapp_title_template,
        inapp_body_template: config.inapp_body_template,
        email_subject_template: config.email_subject_template,
        email_body_template: config.email_body_template,
      })
      .eq('id', config.id);
    setSaving(null);
    if (error) {
      toast.error('Error al guardar configuración');
    } else {
      toast.success('Configuración guardada');
    }
  };

  const createEvent = async () => {
    if (!newEvent.name || !newEvent.event_key) {
      toast.error('Nombre y clave son obligatorios');
      return;
    }
    const { data: evt, error } = await supabase
      .from('notification_events')
      .insert({
        event_key: newEvent.event_key,
        name: newEvent.name,
        description: newEvent.description || null,
        is_system: false,
      })
      .select()
      .single();

    if (error) {
      toast.error(error.message);
      return;
    }

    // Create default config
    const { data: cfg } = await supabase
      .from('notification_configs')
      .insert({
        event_id: (evt as NotificationEvent).id,
        target_roles: ['administrador'],
        include_creator: true,
        channel_inapp: true,
        channel_email: true,
        inapp_title_template: '',
        inapp_body_template: '',
        email_subject_template: '',
        email_body_template: '',
      })
      .select()
      .single();

    setEvents((prev) => [...prev, evt as NotificationEvent]);
    if (cfg) {
      setConfigs((prev) => ({
        ...prev,
        [(evt as NotificationEvent).id]: cfg as NotificationConfig,
      }));
    }
    setNewEvent({ name: '', description: '', event_key: '' });
    setShowNewEvent(false);
    toast.success('Evento creado');
  };

  const deleteEvent = async (event: NotificationEvent) => {
    if (event.is_system) return;
    const { error } = await supabase.from('notification_events').delete().eq('id', event.id);
    if (error) {
      toast.error('Error al eliminar');
    } else {
      setEvents((prev) => prev.filter((e) => e.id !== event.id));
      setConfigs((prev) => {
        const copy = { ...prev };
        delete copy[event.id];
        return copy;
      });
      toast.success('Evento eliminado');
    }
  };

  if (!hasRole('administrador')) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-muted-foreground">No tienes acceso a esta sección.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Administración de Notificaciones</h1>
          <p className="text-muted-foreground">
            Configura eventos, destinatarios, canales y plantillas
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setShowVars(true)}>
            <Info className="w-4 h-4 mr-1" /> Variables
          </Button>
          <Button size="sm" onClick={() => setShowNewEvent(true)}>
            <Plus className="w-4 h-4 mr-1" /> Nuevo Evento
          </Button>
        </div>
      </div>

      {/* Status change events */}
      {(() => {
        const statusEvents = events.filter((e) => e.event_key.startsWith('status_to_'));
        const otherEvents = events.filter((e) => !e.event_key.startsWith('status_to_'));
        return (
          <>
            {statusEvents.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Cambios de Estado
                </h2>
                <Accordion type="multiple" className="space-y-2">
                  {statusEvents.map((event) => {
                    const config = configs[event.id];
                    return (
                      <EventAccordionItem key={event.id} event={event} config={config}
                        onToggleActive={toggleActive} onToggleRole={toggleRole}
                        onUpdateConfig={updateConfig} onSave={saveConfig}
                        onDelete={deleteEvent} saving={saving} />
                    );
                  })}
                </Accordion>
              </div>
            )}

            {otherEvents.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Bell className="w-5 h-5" /> Otros Eventos
                </h2>
                <Accordion type="multiple" className="space-y-2">
                  {otherEvents.map((event) => {
                    const config = configs[event.id];
                    return (
                      <EventAccordionItem key={event.id} event={event} config={config}
                        onToggleActive={toggleActive} onToggleRole={toggleRole}
                        onUpdateConfig={updateConfig} onSave={saveConfig}
                        onDelete={deleteEvent} saving={saving} />
                    );
                  })}
                </Accordion>
              </div>
            )}
          </>
        );
      })()}

      {/* New Event Dialog */}
      <Dialog open={showNewEvent} onOpenChange={setShowNewEvent}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Crear Evento de Notificación</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Nombre</Label>
              <Input
                value={newEvent.name}
                onChange={(e) => setNewEvent((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ej: Aprobación urgente"
              />
            </div>
            <div>
              <Label>Clave única</Label>
              <Input
                value={newEvent.event_key}
                onChange={(e) =>
                  setNewEvent((p) => ({
                    ...p,
                    event_key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
                  }))
                }
                placeholder="Ej: aprobacion_urgente"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Solo letras minúsculas, números y guiones bajos
              </p>
            </div>
            <div>
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={newEvent.description}
                onChange={(e) => setNewEvent((p) => ({ ...p, description: e.target.value }))}
                placeholder="Descripción del evento..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNewEvent(false)}>
              Cancelar
            </Button>
            <Button onClick={createEvent}>Crear</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Variables Reference Dialog */}
      <Dialog open={showVars} onOpenChange={setShowVars}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Variables Disponibles</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mb-4">
            Usa estas variables en las plantillas. Se reemplazarán automáticamente al enviar la notificación.
          </p>
          <div className="space-y-2">
            {TEMPLATE_VARIABLES.map((v) => (
              <div key={v.var} className="flex items-start gap-3 py-1">
                <code className="bg-muted px-2 py-0.5 rounded text-xs shrink-0">{v.var}</code>
                <span className="text-sm text-muted-foreground">{v.desc}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
