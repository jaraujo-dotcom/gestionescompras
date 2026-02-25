import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { StatusBadge } from '@/components/ui/status-badge';
import { DynamicFormView } from '@/components/forms/DynamicFormView';
import { RequestTimeline } from '@/components/requests/RequestTimeline';
import {
  Request, RequestStatusHistory, RequestStatus, Profile,
  FormField, FormSection, FormTemplate, FieldDependency,
  TableColumnSchema, STATUS_LABELS, RequestWorkflowStep,
} from '@/types/database';
import {
  ArrowLeft, Edit, Send, Loader2, Clock, User, Trash2, Ban,
  FileSpreadsheet, Users2, ExternalLink, CheckCircle, XCircle,
  RotateCcw, PlayCircle, PauseCircle, CheckCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { AdminStatusChanger } from '@/components/requests/AdminStatusChanger';
import { exportToExcel } from '@/lib/exportRequest';
import { sendNotification } from '@/lib/notifications';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader,
  AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { ExternalInviteDialog } from '@/components/requests/ExternalInviteDialog';
import { cn } from '@/lib/utils';

function formatRequestNumber(num: number): string {
  return String(num).padStart(6, '0');
}

type ReviewAction = 'approve' | 'return' | 'reject';
type ExecutionAction = 'start' | 'complete' | 'pause' | 'resume';

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

  // Workflow / approval state
  const [workflowSteps, setWorkflowSteps] = useState<(RequestWorkflowStep & { approverName?: string })[]>([]);

  // Dialog state for review/execution actions
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogType, setDialogType] = useState<'review' | 'execution'>('review');
  const [reviewAction, setReviewAction] = useState<ReviewAction>('approve');
  const [executionAction, setExecutionAction] = useState<ExecutionAction>('start');
  const [dialogComment, setDialogComment] = useState('');
  const [processing, setProcessing] = useState(false);

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

      // Fetch creator
      const { data: creatorProfiles } = await supabase.rpc('get_profiles_by_ids', { _ids: [req.created_by] });
      if (creatorProfiles?.length > 0) {
        setCreator({ ...creatorProfiles[0], email: '', created_at: '', updated_at: '' } as Profile);
      }

      // Fetch group name
      if ((req as any).group_id) {
        const { data: grpData } = await supabase.from('groups').select('name').eq('id', (req as any).group_id).single();
        if (grpData) setGroupName(grpData.name);
      } else {
        setGroupName(null);
      }

      // Fetch template, fields, sections
      if (req.template_id) {
        const [templateRes, fieldsRes, sectionsRes] = await Promise.all([
          supabase.from('form_templates').select('*').eq('id', req.template_id).single(),
          supabase.from('form_fields').select('*').eq('template_id', req.template_id).order('field_order'),
          supabase.from('form_sections').select('*').eq('template_id', req.template_id).order('section_order'),
        ]);

        if (templateRes.data) setTemplate(templateRes.data as FormTemplate);
        if (fieldsRes.data) {
          const parsedFields = fieldsRes.data.map((f: any) => ({
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

      // Fetch workflow steps
      const { data: stepsData } = await supabase
        .from('request_workflow_steps').select('*').eq('request_id', id!).order('step_order');
      if (stepsData?.length) {
        const approverIds = [...new Set(stepsData.filter(s => s.approved_by).map(s => s.approved_by))];
        const { data: approverProfiles } = approverIds.length > 0
          ? await supabase.rpc('get_profiles_by_ids', { _ids: approverIds })
          : { data: [] };
        setWorkflowSteps(stepsData.map(s => ({
          ...s,
          approverName: s.approved_by ? approverProfiles?.find((p: any) => p.id === s.approved_by)?.name : undefined,
        })) as (RequestWorkflowStep & { approverName?: string })[]);
      } else {
        setWorkflowSteps([]);
      }

      // Fetch history
      const { data: historyData } = await supabase
        .from('request_status_history').select('*').eq('request_id', id)
        .order('created_at', { ascending: false });
      if (historyData) {
        const userIds = [...new Set(historyData.map(h => h.changed_by))];
        const { data: profiles } = await supabase.rpc('get_profiles_by_ids', { _ids: userIds });
        setHistory(historyData.map(h => ({
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

  // ─── Workflow helpers ───
  const getCurrentLevel = (): number | null => {
    const pendingSteps = workflowSteps.filter(s => s.status === 'pending');
    if (pendingSteps.length === 0) return null;
    return Math.min(...pendingSteps.map(s => s.step_order));
  };
  const currentLevel = getCurrentLevel();
  const currentLevelSteps = currentLevel !== null
    ? workflowSteps.filter(s => s.step_order === currentLevel && s.status === 'pending')
    : [];
  const myCurrentStep = currentLevelSteps.find(
    s => hasRole(s.role_name as any) || hasRole('administrador')
  ) || null;
  const canActReview = !!(request?.status === 'en_revision' && myCurrentStep);

  // ─── Execution helpers ───
  const isExecutor = hasRole('ejecutor') || hasRole('administrador');
  const canActExecution = isExecutor && request && ['aprobada', 'en_ejecucion', 'en_espera'].includes(request.status);

  // ─── Request owner actions ───
  const handleSubmitForReview = async () => {
    if (!request || !user) return;
    try {
      let hasWorkflow = false;
      if (request.template_id) {
        const { data: tplData } = await supabase
          .from('form_templates').select('default_workflow_id').eq('id', request.template_id).single();
        hasWorkflow = !!tplData?.default_workflow_id;
      }
      const newStatus = hasWorkflow ? 'en_revision' : 'aprobada';
      await supabase.from('requests').update({ status: newStatus }).eq('id', request.id);
      await supabase.from('request_status_history').insert({
        request_id: request.id, from_status: request.status, to_status: newStatus,
        changed_by: user.id,
        comment: hasWorkflow ? 'Solicitud enviada a revisión' : 'Solicitud aprobada automáticamente (sin flujo de aprobación)',
      });
      sendNotification({
        requestId: request.id, eventType: 'status_change',
        title: `Solicitud #${formatRequestNumber(request.request_number)}: ${hasWorkflow ? 'En Revisión' : 'Aprobada'}`,
        message: hasWorkflow ? `${profile?.name || 'Usuario'} envió "${request.title}" a revisión.` : 'Aprobada automáticamente (sin flujo de aprobación).',
        triggeredBy: user.id, newStatus,
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
      await supabase.from('requests').update({ status: 'anulada' }).eq('id', request.id);
      await supabase.from('request_status_history').insert({
        request_id: request.id, from_status: request.status, to_status: 'anulada',
        changed_by: user.id, comment: 'Solicitud anulada',
      });
      sendNotification({
        requestId: request.id, eventType: 'status_change',
        title: `Solicitud #${formatRequestNumber(request.request_number)}: Anulada`,
        message: `${profile?.name || 'Usuario'} anuló la solicitud "${request.title}".`,
        triggeredBy: user.id, newStatus: 'anulada',
      });
      toast.success('Solicitud anulada');
      fetchRequestData();
    } catch (error) {
      console.error('Error annulling:', error);
      toast.error('Error al anular la solicitud');
    }
  };

  // ─── Review actions ───
  const openReviewDialog = (action: ReviewAction) => {
    setDialogType('review');
    setReviewAction(action);
    setDialogComment('');
    setDialogOpen(true);
  };

  const handleReviewAction = async () => {
    if (!request || !user || !myCurrentStep) return;
    if ((reviewAction === 'return' || reviewAction === 'reject') && !dialogComment.trim()) {
      toast.error('El comentario es requerido');
      return;
    }
    setProcessing(true);
    try {
      if (reviewAction === 'approve') {
        await supabase.from('request_workflow_steps')
          .update({ status: 'approved', approved_by: user.id, comment: dialogComment.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', myCurrentStep.id);

        const siblingSteps = workflowSteps.filter(s => s.step_order === myCurrentStep.step_order && s.id !== myCurrentStep.id);
        const allSiblingsApproved = siblingSteps.every(s => s.status === 'approved');
        const hasNextLevel = workflowSteps.some(s => s.step_order > myCurrentStep.step_order);

        if (allSiblingsApproved && !hasNextLevel) {
          await supabase.from('requests').update({ status: 'aprobada' }).eq('id', request.id);
          sendNotification({
            requestId: request.id, eventType: 'status_change',
            title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['aprobada']}`,
            message: `"${request.title}" ha sido aprobada y pasa a ejecución.`,
            triggeredBy: user.id, newStatus: 'aprobada',
          });
          toast.success('Solicitud completamente aprobada');
        } else {
          sendNotification({
            requestId: request.id, eventType: 'status_change',
            title: `Solicitud #${formatRequestNumber(request.request_number)}: Paso aprobado`,
            message: `${profile?.name || 'Usuario'} aprobó el paso "${myCurrentStep.label}".`,
            triggeredBy: user.id,
          });
          toast.success(allSiblingsApproved ? 'Nivel completado. Avanza al siguiente nivel.' : `Paso "${myCurrentStep.label}" aprobado.`);
        }

        const fullyApproved = allSiblingsApproved && !hasNextLevel;
        await supabase.from('request_status_history').insert({
          request_id: request.id, from_status: request.status,
          to_status: fullyApproved ? 'aprobada' : request.status,
          changed_by: user.id,
          comment: `[${myCurrentStep.label}] Aprobado: ${dialogComment}`,
        });
      } else if (reviewAction === 'reject') {
        await supabase.from('request_workflow_steps')
          .update({ status: 'rejected', approved_by: user.id, comment: dialogComment.trim() || null, updated_at: new Date().toISOString() })
          .eq('id', myCurrentStep.id);
        await supabase.from('requests').update({ status: 'rechazada' }).eq('id', request.id);
        await supabase.from('request_status_history').insert({
          request_id: request.id, from_status: request.status, to_status: 'rechazada',
          changed_by: user.id, comment: `[${myCurrentStep.label}] Rechazado: ${dialogComment}`,
        });
        sendNotification({
          requestId: request.id, eventType: 'status_change',
          title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['rechazada']}`,
          message: `${profile?.name || 'Usuario'} rechazó "${request.title}". Razón: ${dialogComment}`,
          triggeredBy: user.id, newStatus: 'rechazada',
        });
        toast.success('Solicitud rechazada');
      } else if (reviewAction === 'return') {
        await supabase.from('request_workflow_steps')
          .update({ status: 'pending', approved_by: null, comment: null })
          .eq('request_id', request.id);
        await supabase.from('requests').update({ status: 'devuelta' }).eq('id', request.id);
        await supabase.from('request_status_history').insert({
          request_id: request.id, from_status: request.status, to_status: 'devuelta',
          changed_by: user.id, comment: `[${myCurrentStep.label}] Devuelto: ${dialogComment}`,
        });
        sendNotification({
          requestId: request.id, eventType: 'status_change',
          title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['devuelta']}`,
          message: `${profile?.name || 'Usuario'} devolvió "${request.title}". Razón: ${dialogComment}`,
          triggeredBy: user.id, newStatus: 'devuelta',
        });
        toast.success('Solicitud devuelta');
      }
      setDialogOpen(false);
      fetchRequestData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la acción');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Execution actions ───
  const openExecutionDialog = (action: ExecutionAction) => {
    setDialogType('execution');
    setExecutionAction(action);
    setDialogComment('');
    setDialogOpen(true);
  };

  const handleExecutionAction = async () => {
    if (!request || !user) return;
    setProcessing(true);
    try {
      const statusMap: Record<ExecutionAction, RequestStatus> = {
        start: 'en_ejecucion', complete: 'completada', pause: 'en_espera', resume: 'en_ejecucion',
      };
      const newStatus = statusMap[executionAction];
      await supabase.from('requests').update({ status: newStatus }).eq('id', request.id);
      await supabase.from('request_status_history').insert({
        request_id: request.id, from_status: request.status, to_status: newStatus,
        changed_by: user.id, comment: dialogComment.trim() || null,
      });
      sendNotification({
        requestId: request.id, eventType: 'status_change',
        title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS[newStatus]}`,
        message: `${profile?.name || 'Usuario'} cambió el estado de "${request.title}" a ${STATUS_LABELS[newStatus]}.${dialogComment.trim() ? `\n📝 ${dialogComment.trim()}` : ''}`,
        triggeredBy: user.id, newStatus,
      });
      const messages: Record<ExecutionAction, string> = {
        start: 'Ejecución iniciada', complete: 'Solicitud completada', pause: 'Solicitud en espera', resume: 'Ejecución reanudada',
      };
      toast.success(messages[executionAction]);
      setDialogOpen(false);
      fetchRequestData();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la acción');
    } finally {
      setProcessing(false);
    }
  };

  // ─── Export ───
  const handleExport = async () => {
    if (!request) return;
    const { data: commentsData } = await supabase
      .from('request_comments').select('*').eq('request_id', request.id).order('created_at', { ascending: true });
    let commentProfiles: { id: string; name: string }[] = [];
    if (commentsData?.length) {
      const userIds = [...new Set(commentsData.map(c => c.user_id))];
      const { data } = await supabase.rpc('get_profiles_by_ids', { _ids: userIds });
      commentProfiles = data || [];
    }
    exportToExcel({
      requestNumber: request.request_number, title: request.title, status: request.status as RequestStatus,
      creatorName: creator?.name || 'Desconocido', createdAt: request.created_at,
      templateName: template?.name, groupName: groupName || undefined, fields,
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
    });
  };

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  if (!request) {
    return <div className="p-6 text-center"><p>Solicitud no encontrada</p></div>;
  }

  const canEdit = request.created_by === user?.id && (request.status === 'borrador' || request.status === 'devuelta');
  const canInviteExternal = hasExternalFields && (request.status === 'borrador' || request.status === 'esperando_tercero') && request.created_by === user?.id;
  const canDelete = request.status === 'borrador' && (request.created_by === user?.id || hasRole('gerencia') || hasRole('administrador'));
  const canAnnul = request.status !== 'borrador' && request.status !== 'anulada' && request.status !== 'completada' && (request.created_by === user?.id || hasRole('gerencia') || hasRole('administrador'));

  // Dialog labels
  const reviewLabels: Record<ReviewAction, { title: string; description: string; buttonText: string }> = {
    approve: { title: 'Aprobar Paso', description: `¿Está seguro de aprobar el paso "${myCurrentStep?.label}"?`, buttonText: 'Aprobar' },
    return: { title: 'Devolver Solicitud', description: 'Se reiniciarán todos los pasos de aprobación.', buttonText: 'Devolver' },
    reject: { title: 'Rechazar Solicitud', description: 'Esta acción rechazará permanentemente la solicitud.', buttonText: 'Rechazar' },
  };
  const executionLabels: Record<ExecutionAction, { title: string; description: string; buttonText: string }> = {
    start: { title: 'Iniciar Ejecución', description: 'La solicitud pasará a estado "En Ejecución".', buttonText: 'Iniciar' },
    complete: { title: 'Completar Solicitud', description: 'Marque la solicitud como completada.', buttonText: 'Completar' },
    pause: { title: 'Poner en Espera', description: 'La solicitud pasará a estado "En Espera".', buttonText: 'Poner en Espera' },
    resume: { title: 'Reanudar Ejecución', description: 'La solicitud volverá a estado "En Ejecución".', buttonText: 'Reanudar' },
  };

  const currentDialogLabels = dialogType === 'review' ? reviewLabels[reviewAction] : executionLabels[executionAction];
  const isCommentRequired = dialogType === 'review' && (reviewAction === 'return' || reviewAction === 'reject');

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* ─── Header ─── */}
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
            </div>
            <p className="text-muted-foreground">
              {template?.name && <span className="mr-2">• {template.name}</span>}
              {groupName && <span className="mr-2 inline-flex items-center gap-1">• <Users2 className="w-3 h-3" /> {groupName}</span>}
              Solicitante: {creator?.name || 'Desconocido'} • Creada: {new Date(request.created_at).toLocaleDateString('es-ES', { day: '2-digit', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap justify-end">
          <Button variant="outline" size="sm" onClick={handleExport}>
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
                <Button variant="outline"><Edit className="w-4 h-4 mr-2" /> Editar</Button>
              </Link>
              {request.status === 'devuelta' && (
                <Button onClick={handleSubmitForReview}><Send className="w-4 h-4 mr-2" /> Reenviar</Button>
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

      {/* ─── Workflow Approval Panel (only when in_revision and has steps) ─── */}
      {request.status === 'en_revision' && workflowSteps.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Flujo de Aprobación</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(() => {
                const levels: Record<number, typeof workflowSteps> = {};
                workflowSteps.forEach(s => { if (!levels[s.step_order]) levels[s.step_order] = []; levels[s.step_order].push(s); });
                const sortedLevels = Object.keys(levels).map(Number).sort((a, b) => a - b);
                return sortedLevels.map((level, levelIdx) => {
                  const levelSteps = levels[level];
                  const isParallel = levelSteps.length > 1;
                  return (
                    <div key={level}>
                      <div className="text-xs font-semibold text-muted-foreground mb-1">
                        Nivel {levelIdx + 1}{isParallel ? ' (paralelo)' : ''}
                      </div>
                      <div className={cn('grid gap-2', isParallel ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
                        {levelSteps.map((step) => {
                          const isMyStep = myCurrentStep?.id === step.id;
                          const isActiveLevel = currentLevel === step.step_order;
                          return (
                            <div key={step.id} className={cn(
                              'p-3 rounded-lg border transition-colors text-sm',
                              step.status === 'approved' && 'border-emerald-300 bg-emerald-50',
                              step.status === 'rejected' && 'border-red-300 bg-red-50',
                              step.status === 'pending' && isMyStep && 'border-primary/50 bg-primary/5 ring-1 ring-primary/30',
                              step.status === 'pending' && isActiveLevel && !isMyStep && 'border-amber-200 bg-amber-50/50',
                              step.status === 'pending' && !isActiveLevel && 'border-muted bg-muted/30',
                            )}>
                              <div className="flex items-center justify-between">
                                <span className="font-medium">{step.label}</span>
                                {step.status === 'approved' && <CheckCircle className="w-4 h-4 text-emerald-600" />}
                                {step.status === 'rejected' && <XCircle className="w-4 h-4 text-red-600" />}
                                {step.status === 'pending' && <Clock className="w-4 h-4 text-muted-foreground" />}
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {step.status === 'approved' && `Aprobado por ${step.approverName || 'Usuario'}`}
                                {step.status === 'pending' && (isActiveLevel ? 'En espera de aprobación...' : 'Pendiente')}
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Review action buttons */}
            {canActReview && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <p className="text-sm font-medium">
                  Acción requerida: <span className="text-primary">{myCurrentStep?.label}</span>
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => openReviewDialog('return')}>
                    <RotateCcw className="w-4 h-4 mr-1" /> Devolver
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => openReviewDialog('reject')}>
                    <XCircle className="w-4 h-4 mr-1" /> Rechazar
                  </Button>
                  <Button size="sm" onClick={() => openReviewDialog('approve')}>
                    <CheckCircle className="w-4 h-4 mr-1" /> Aprobar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ─── Execution Actions (inline) ─── */}
      {canActExecution && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium text-sm">Acciones de ejecución</p>
              <div className="flex gap-2">
                {request.status === 'aprobada' && (
                  <Button size="sm" onClick={() => openExecutionDialog('start')}>
                    <PlayCircle className="w-4 h-4 mr-1" /> Iniciar Ejecución
                  </Button>
                )}
                {request.status === 'en_ejecucion' && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => openExecutionDialog('pause')}>
                      <PauseCircle className="w-4 h-4 mr-1" /> En Espera
                    </Button>
                    <Button size="sm" onClick={() => openExecutionDialog('complete')}>
                      <CheckCheck className="w-4 h-4 mr-1" /> Completar
                    </Button>
                  </>
                )}
                {request.status === 'en_espera' && (
                  <Button size="sm" onClick={() => openExecutionDialog('resume')}>
                    <PlayCircle className="w-4 h-4 mr-1" /> Reanudar
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ─── Form Data ─── */}
      {fields.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Datos de la Solicitud</CardTitle></CardHeader>
          <CardContent>
            <DynamicFormView fields={fields} sections={sections} values={request.data_json as Record<string, unknown>} />
          </CardContent>
        </Card>
      )}

      {/* ─── External Invite Dialog ─── */}
      {request && (
        <ExternalInviteDialog
          open={showInviteDialog} onOpenChange={setShowInviteDialog}
          requestId={request.id} requestNumber={request.request_number}
          onInviteCreated={fetchRequestData}
        />
      )}

      {/* ─── Timeline (comments + history unified) ─── */}
      <RequestTimeline requestId={request.id} requestNumber={request.request_number} history={history} />

      {/* ─── Action Dialog (shared for review and execution) ─── */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{currentDialogLabels.title}</DialogTitle>
            <DialogDescription>{currentDialogLabels.description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="dialog-comment">Comentario {isCommentRequired && '*'}</Label>
            <Textarea
              id="dialog-comment" value={dialogComment}
              onChange={(e) => setDialogComment(e.target.value)}
              placeholder="Escriba su comentario..." rows={3} className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>Cancelar</Button>
            <Button
              onClick={dialogType === 'review' ? handleReviewAction : handleExecutionAction}
              disabled={processing}
              variant={dialogType === 'review' && reviewAction === 'reject' ? 'destructive' : 'default'}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {currentDialogLabels.buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
