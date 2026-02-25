import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { DynamicFormView } from '@/components/forms/DynamicFormView';
import { RequestTimeline } from '@/components/requests/RequestTimeline';
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
import { ArrowLeft, Edit, Send, Loader2, Clock, User, Trash2, Ban, FileSpreadsheet, Users2, ShieldCheck, ExternalLink } from 'lucide-react';
import { toast } from 'sonner';
import { AdminStatusChanger } from '@/components/requests/AdminStatusChanger';
import { exportToExcel } from '@/lib/exportRequest';
import { sendNotification } from '@/lib/notifications';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { ExternalInviteDialog } from '@/components/requests/ExternalInviteDialog';
function formatRequestNumber(num: number): string {
  return String(num).padStart(6, '0');
}

export default function RequestDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, hasRole, profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [request, setRequest] = useState<Request | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [groupName, setGroupName] = useState<string | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [history, setHistory] = useState<(RequestStatusHistory & { profile?: Profile })[]>([]);
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [hasExternalFields, setHasExternalFields] = useState(false);
  useEffect(() => {
    if (id) fetchRequestData();
  }, [id]);

  const fetchRequestData = async () => {
    try {
      const { data: requestData, error: requestError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', id)
        .single();

      if (requestError) throw requestError;

      const req = requestData as Request;
      setRequest(req);

      // Fetch creator
      const { data: creatorProfiles } = await supabase.rpc('get_profiles_by_ids', { _ids: [req.created_by] });
      if (creatorProfiles && creatorProfiles.length > 0) {
        setCreator({ ...creatorProfiles[0], email: '', created_at: '', updated_at: '' } as Profile);
      }

      // Fetch group name
      if ((req as any).group_id) {
        const { data: grpData } = await supabase.from('groups').select('name').eq('id', (req as any).group_id).single();
        if (grpData) setGroupName(grpData.name);
      } else {
        setGroupName(null);
      }

      // Fetch template and fields if exists
      if (req.template_id) {
        const [templateRes, fieldsRes, sectionsRes] = await Promise.all([
          supabase.from('form_templates').select('*').eq('id', req.template_id).single(),
          supabase.from('form_fields').select('*').eq('template_id', req.template_id).order('field_order'),
          supabase.from('form_sections').select('*').eq('template_id', req.template_id).order('section_order'),
        ]);

        if (templateRes.data) setTemplate(templateRes.data as FormTemplate);

        if (fieldsRes.data) {
          const parsedFields = fieldsRes.data.map((f) => ({
            ...f,
            field_type: f.field_type as FormField['field_type'],
            options_json: f.options_json as string[] | null,
            table_schema_json: f.table_schema_json as unknown as TableColumnSchema[] | null,
            dependency_json: f.dependency_json as unknown as FieldDependency | null,
            section_id: f.section_id || null,
          }));
          setFields(parsedFields);
          setHasExternalFields(fieldsRes.data.some((f: any) => 
            f.is_external === true || 
            (f.field_type === 'table' && Array.isArray(f.table_schema_json) && 
              (f.table_schema_json as any[]).some((col: any) => col.is_external))
          ));
        }
        setSections((sectionsRes.data || []) as FormSection[]);
      }

      // Fetch history
      const { data: historyData } = await supabase
        .from('request_status_history')
        .select('*')
        .eq('request_id', id)
        .order('created_at', { ascending: false });

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
      navigate('/requests');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitForReview = async () => {
    if (!request || !user) return;
    try {
      // Check if template has a workflow
      let hasWorkflow = false;
      if (request.template_id) {
        const { data: tplData } = await supabase
          .from('form_templates')
          .select('default_workflow_id')
          .eq('id', request.template_id)
          .single();
        hasWorkflow = !!tplData?.default_workflow_id;
      }

      const newStatus = hasWorkflow ? 'en_revision' : 'aprobada';

      await supabase.from('requests').update({ status: newStatus }).eq('id', request.id);
      await supabase.from('request_status_history').insert({
        request_id: request.id, from_status: request.status, to_status: newStatus,
        changed_by: user.id,
        comment: hasWorkflow ? 'Solicitud enviada a revisión' : 'Solicitud aprobada automáticamente (sin flujo de aprobación)',
      });

      const statusLabel = hasWorkflow ? 'En Revisión' : 'Aprobada';
      sendNotification({
        requestId: request.id,
        eventType: 'status_change',
        title: `Solicitud #${formatRequestNumber(request.request_number)}: ${statusLabel}`,
        message: hasWorkflow ? `${profile?.name || 'Usuario'} envió "${request.title}" a revisión.` : 'Aprobada automáticamente (sin flujo de aprobación).',
        triggeredBy: user.id,
        newStatus: newStatus,
      });
      toast.success(hasWorkflow ? 'Solicitud enviada a revisión' : 'Solicitud lista para ejecución');
      fetchRequestData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al enviar la solicitud');
    }
  };

  const handleDelete = async () => {
    if (!request || !user) return;
    try {
      await supabase.from('request_status_history').delete().eq('request_id', request.id);
      await supabase.from('request_items').delete().eq('request_id', request.id);
      const { error } = await supabase.from('requests').delete().eq('id', request.id);
      if (error) throw error;
      toast.success('Solicitud eliminada');
      navigate('/requests');
    } catch (error) {
      console.error('Error deleting:', error);
      toast.error('Error al eliminar la solicitud');
    }
  };

  const handleAnnul = async () => {
    if (!request || !user) return;
    try {
      const { error } = await supabase.from('requests').update({ status: 'anulada' }).eq('id', request.id);
      if (error) throw error;
      await supabase.from('request_status_history').insert({
        request_id: request.id, from_status: request.status, to_status: 'anulada',
        changed_by: user.id, comment: 'Solicitud anulada',
      });
      sendNotification({
        requestId: request.id,
        eventType: 'status_change',
        title: `Solicitud #${formatRequestNumber(request.request_number)}: Anulada`,
        message: `${profile?.name || 'Usuario'} anuló la solicitud "${request.title}".`,
        triggeredBy: user.id,
        newStatus: 'anulada',
      });
      toast.success('Solicitud anulada');
      fetchRequestData();
    } catch (error) {
      console.error('Error annulling:', error);
      toast.error('Error al anular la solicitud');
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
      groupName: groupName || undefined,
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
      <div className="p-6 text-center">
        <p>Solicitud no encontrada</p>
      </div>
    );
  }

  const canEdit = request.created_by === user?.id &&
    (request.status === 'borrador' || request.status === 'devuelta');

  const canInviteExternal = hasExternalFields && 
    (request.status === 'borrador' || request.status === 'esperando_tercero') &&
    request.created_by === user?.id;

  const canDelete = request.status === 'borrador' && (
    request.created_by === user?.id || hasRole('gerencia') || hasRole('administrador')
  );

  const canAnnul = request.status !== 'borrador' && request.status !== 'anulada' && request.status !== 'completada' && (
    request.created_by === user?.id || hasRole('gerencia') || hasRole('administrador')
  );

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-sm font-mono text-muted-foreground">#{formatRequestNumber(request.request_number)}</span>
              <h1 className="text-2xl font-bold">{request.title}</h1>
              {hasRole('administrador') && user ? (
                <AdminStatusChanger requestId={request.id} currentStatus={request.status as RequestStatus} userId={user.id} onStatusChanged={fetchRequestData} />
              ) : (
                <StatusBadge status={request.status as RequestStatus} />
              )}
              {request.status === 'en_revision' && (
                <Link to={`/review/${request.id}`}>
                  <Button variant="secondary" size="sm" className="ml-2">
                    <ShieldCheck className="w-4 h-4 mr-2" /> Gestionar Aprobación
                  </Button>
                </Link>
              )}
            </div>
            <p className="text-muted-foreground">
              {template?.name && <span className="mr-2">• {template.name}</span>}
              {groupName && (
                <span className="mr-2 inline-flex items-center gap-1">• <Users2 className="w-3 h-3" /> {groupName}</span>
              )}
              Solicitante: {creator?.name || 'Desconocido'} • Creada: {new Date(request.created_at).toLocaleDateString('es-ES', {
                day: '2-digit', month: 'long', year: 'numeric',
              })}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={() => handleExport()}>
            <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
          </Button>
          {canInviteExternal && (
            <Button variant="outline" size="sm" onClick={() => setShowInviteDialog(true)}>
              <ExternalLink className="w-4 h-4 mr-1" /> Invitar Externo
            </Button>
          )}
          {canEdit && (
            <>
              <Link to={`/requests/${request.id}/edit`}>
                <Button variant="outline">
                  <Edit className="w-4 h-4 mr-2" /> Editar
                </Button>
              </Link>
              {request.status === 'devuelta' && (
                <Button onClick={handleSubmitForReview}>
                  <Send className="w-4 h-4 mr-2" /> Reenviar
                </Button>
              )}
            </>
          )}
          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive"><Trash2 className="w-4 h-4 mr-2" /> Eliminar</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Eliminar solicitud?</AlertDialogTitle>
                  <AlertDialogDescription>Esta acción eliminará permanentemente la solicitud.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Eliminar</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
          {canAnnul && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" className="text-destructive border-destructive/50 hover:bg-destructive/10">
                  <Ban className="w-4 h-4 mr-2" /> Anular
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>¿Anular solicitud?</AlertDialogTitle>
                  <AlertDialogDescription>La solicitud será marcada como anulada.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={handleAnnul} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Anular</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </div>

      {fields.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Datos de la Solicitud</CardTitle></CardHeader>
          <CardContent>
            <DynamicFormView fields={fields} sections={sections} values={request.data_json as Record<string, unknown>} />
          </CardContent>
        </Card>
      )}


      {request && (
        <ExternalInviteDialog
          open={showInviteDialog}
          onOpenChange={setShowInviteDialog}
          requestId={request.id}
          requestNumber={request.request_number}
          onInviteCreated={fetchRequestData}
        />
      )}

      <RequestTimeline requestId={request.id} requestNumber={request.request_number} history={history} />
    </div>
  );
}
