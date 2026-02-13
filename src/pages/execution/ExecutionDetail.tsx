import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { DynamicFormView } from '@/components/forms/DynamicFormView';
import { RequestComments } from '@/components/requests/RequestComments';
import {
  Request,
  RequestStatusHistory,
  RequestStatus,
  Profile,
  FormField,
  FormSection,
  FormTemplate,
  FieldDependency,
  TableColumnSchema,
  STATUS_LABELS,
} from '@/types/database';
import {
  ArrowLeft, PlayCircle, CheckCheck, Loader2, Clock, User, MessageSquare, PauseCircle, FileSpreadsheet,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/exportRequest';
import { sendNotification } from '@/lib/notifications';

type ExecutionAction = 'start' | 'complete' | 'pause' | 'resume';

function formatRequestNumber(num: number): string {
  return String(num).padStart(6, '0');
}

export default function ExecutionDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [history, setHistory] = useState<(RequestStatusHistory & { profile?: Profile })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<ExecutionAction>('start');
  const [note, setNote] = useState('');

  useEffect(() => {
    if (id) fetchRequestData();
  }, [id]);

  const fetchRequestData = async () => {
    try {
      const { data: requestData, error: requestError } = await supabase
        .from('requests').select('*').eq('id', id).single();
      if (requestError) throw requestError;

      const req = requestData as Request;
      setRequest(req);

      const { data: creatorProfiles } = await supabase.rpc('get_profiles_by_ids', { _ids: [req.created_by] });
      if (creatorProfiles && creatorProfiles.length > 0) {
        setCreator({ ...creatorProfiles[0], email: '', created_at: '', updated_at: '' } as Profile);
      }

      if (req.template_id) {
        const [templateRes, fieldsRes, sectionsRes] = await Promise.all([
          supabase.from('form_templates').select('*').eq('id', req.template_id).single(),
          supabase.from('form_fields').select('*').eq('template_id', req.template_id).order('field_order'),
          supabase.from('form_sections').select('*').eq('template_id', req.template_id).order('section_order'),
        ]);
        if (templateRes.data) setTemplate(templateRes.data as FormTemplate);
        if (fieldsRes.data) {
          setFields(fieldsRes.data.map((f) => ({
            ...f,
            field_type: f.field_type as FormField['field_type'],
            options_json: f.options_json as string[] | null,
            table_schema_json: f.table_schema_json as unknown as TableColumnSchema[] | null,
            dependency_json: f.dependency_json as unknown as FieldDependency | null,
            section_id: f.section_id || null,
          })));
        }
        setSections((sectionsRes.data || []) as FormSection[]);
      }

      const { data: historyData } = await supabase
        .from('request_status_history').select('*').eq('request_id', id).order('created_at', { ascending: false });
      if (historyData) {
        const userIds = [...new Set(historyData.map((h) => h.changed_by))];
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', { _ids: userIds });
        setHistory(historyData.map((h) => ({
          ...h,
          profile: profiles?.find((p: { id: string; name: string }) => p.id === h.changed_by),
        })) as (RequestStatusHistory & { profile?: Profile })[]);
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      toast.error('Error al cargar la solicitud');
      navigate('/execution');
    } finally {
      setLoading(false);
    }
  };

  const openDialog = (selectedAction: ExecutionAction) => {
    setAction(selectedAction);
    setNote('');
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!request || !user) return;
    setProcessing(true);
    try {
      const statusMap: Record<ExecutionAction, RequestStatus> = {
        start: 'en_ejecucion',
        complete: 'completada',
        pause: 'en_espera',
        resume: 'en_ejecucion',
      };
      const newStatus = statusMap[action];

      await supabase.from('requests').update({ status: newStatus }).eq('id', request.id);
      await supabase.from('request_status_history').insert({
        request_id: request.id, from_status: request.status, to_status: newStatus,
        changed_by: user.id, comment: note.trim() || null,
      });

      sendNotification({
        requestId: request.id,
        eventType: 'status_change',
        title: `Solicitud #${String(request.request_number).padStart(6, '0')}: ${STATUS_LABELS[newStatus]}`,
        message: `${profile?.name || 'Usuario'} cambió el estado de "${request.title}" a ${STATUS_LABELS[newStatus]}.${note.trim() ? `<br><br><b>📝 Nota:</b> ${note.trim()}` : ''}`,
        triggeredBy: user.id,
        newStatus,
      });

      const messages: Record<ExecutionAction, string> = {
        start: 'Ejecución iniciada',
        complete: 'Solicitud completada',
        pause: 'Solicitud en espera',
        resume: 'Ejecución reanudada',
      };
      toast.success(messages[action]);
      
      if (action === 'complete') {
        navigate('/execution');
      } else {
        fetchRequestData();
        setDialogOpen(false);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la acción');
    } finally {
      setProcessing(false);
    }
  };

  const handleExport = async () => {
    if (!request) return;
    const { data: commentsData } = await supabase
      .from('request_comments').select('*').eq('request_id', request.id).order('created_at', { ascending: true });
    
    let commentProfiles: { id: string; name: string }[] = [];
    if (commentsData && commentsData.length > 0) {
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data } = await supabase.rpc('get_profiles_by_ids', { _ids: userIds });
      commentProfiles = data || [];
    }

    const exportData = {
      requestNumber: request.request_number,
      title: request.title,
      status: request.status as RequestStatus,
      creatorName: creator?.name || 'Desconocido',
      createdAt: request.created_at,
      templateName: template?.name,
      fields,
      values: request.data_json as Record<string, unknown>,
      history: history.map(h => ({
        date: new Date(h.created_at).toLocaleString('es-ES'),
        user: h.profile?.name || 'Usuario',
        status: STATUS_LABELS[h.to_status as RequestStatus] || h.to_status,
        comment: h.comment || undefined,
      })),
      comments: (commentsData || []).map(c => ({
        date: new Date(c.created_at).toLocaleString('es-ES'),
        user: commentProfiles.find(p => p.id === c.user_id)?.name || 'Usuario',
        comment: c.comment,
      })),
    };

    exportToExcel(exportData);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!request) {
    return (
      <div className="p-6 text-center"><p>Solicitud no encontrada</p></div>
    );
  }

  const actionLabels: Record<ExecutionAction, { title: string; description: string; buttonText: string }> = {
    start: { title: 'Iniciar Ejecución', description: 'La solicitud pasará a estado "En Ejecución".', buttonText: 'Iniciar' },
    complete: { title: 'Completar Solicitud', description: 'Marque la solicitud como completada.', buttonText: 'Completar' },
    pause: { title: 'Poner en Espera', description: 'La solicitud pasará a estado "En Espera".', buttonText: 'Poner en Espera' },
    resume: { title: 'Reanudar Ejecución', description: 'La solicitud volverá a estado "En Ejecución".', buttonText: 'Reanudar' },
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/execution')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="text-sm font-mono text-muted-foreground">#{formatRequestNumber(request.request_number)}</span>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              <StatusBadge status={request.status as RequestStatus} />
            </div>
            <p className="text-muted-foreground">
              {template?.name && <span className="mr-2">• {template.name}</span>}
              Solicitante: {creator?.name || 'Desconocido'}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => handleExport()}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
        </div>
      </div>

      {/* Action Buttons */}
      {(request.status === 'aprobada' || request.status === 'en_ejecucion' || request.status === 'en_espera') && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">Acciones de ejecución</p>
              <div className="flex gap-2">
                {request.status === 'aprobada' && (
                  <Button onClick={() => openDialog('start')}>
                    <PlayCircle className="w-4 h-4 mr-2" /> Iniciar Ejecución
                  </Button>
                )}
                {request.status === 'en_ejecucion' && (
                  <>
                    <Button variant="outline" onClick={() => openDialog('pause')}>
                      <PauseCircle className="w-4 h-4 mr-2" /> En Espera
                    </Button>
                    <Button onClick={() => openDialog('complete')}>
                      <CheckCheck className="w-4 h-4 mr-2" /> Marcar Completada
                    </Button>
                  </>
                )}
                {request.status === 'en_espera' && (
                  <Button onClick={() => openDialog('resume')}>
                    <PlayCircle className="w-4 h-4 mr-2" /> Reanudar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {fields.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Datos de la Solicitud</CardTitle></CardHeader>
          <CardContent>
            <DynamicFormView fields={fields} sections={sections} values={request.data_json as Record<string, unknown>} />
          </CardContent>
        </Card>
      )}

      <RequestComments requestId={request.id} requestNumber={request.request_number} />

      <Card>
        <CardHeader><CardTitle>Historial</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-4">
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin historial</p>
            ) : (
              history.map((entry) => (
                <div key={entry.id} className="flex gap-3 pb-4 border-b last:border-0">
                  <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium">{entry.profile?.name || 'Usuario'}</span>
                      <StatusBadge status={entry.to_status as RequestStatus} />
                    </div>
                    {entry.comment && (
                      <p className="text-sm text-muted-foreground flex items-start gap-1">
                        <MessageSquare className="w-3 h-3 mt-1 shrink-0" /> {entry.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {new Date(entry.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabels[action].title}</DialogTitle>
            <DialogDescription>{actionLabels[action].description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="note">Nota (opcional)</Label>
            <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Agregue notas..." rows={3} className="mt-2" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>Cancelar</Button>
            <Button onClick={handleAction} disabled={processing}>
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionLabels[action].buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
