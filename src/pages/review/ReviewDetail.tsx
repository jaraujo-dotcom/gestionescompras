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
  Request, RequestStatusHistory, RequestStatus, Profile,
  FormField, FormSection, FormTemplate, FieldDependency,
  TableColumnSchema, STATUS_LABELS, RequestWorkflowStep,
} from '@/types/database';
import {
  ArrowLeft, CheckCircle, RotateCcw, XCircle, Loader2,
  Clock, User, MessageSquare, FileSpreadsheet,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { exportToExcel } from '@/lib/exportRequest';
import { sendNotification } from '@/lib/notifications';
import { cn } from '@/lib/utils';

type ReviewAction = 'approve' | 'return' | 'reject';

function formatRequestNumber(num: number): string {
  return String(num).padStart(6, '0');
}

export default function ReviewDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, profile, hasRole } = useAuth();
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [creator, setCreator] = useState<Profile | null>(null);
  const [template, setTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [history, setHistory] = useState<(RequestStatusHistory & { profile?: Profile })[]>([]);
  const [workflowSteps, setWorkflowSteps] = useState<(RequestWorkflowStep & { approverName?: string })[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [action, setAction] = useState<ReviewAction>('approve');
  const [comment, setComment] = useState('');

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
      const { data: creatorProfiles } = await supabase
        .rpc('get_profiles_by_ids', { _ids: [req.created_by] });
      if (creatorProfiles?.length > 0) {
        setCreator({ ...creatorProfiles[0], email: '', created_at: '', updated_at: '' } as Profile);
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
          const parsedFields: FormField[] = fieldsRes.data.map((f: any) => ({
            ...f,
            field_type: f.field_type as FormField['field_type'],
            options_json: f.options_json as string[] | null,
            table_schema_json: f.table_schema_json as unknown as TableColumnSchema[] | null,
            dependency_json: f.dependency_json as unknown as FieldDependency | null,
            section_id: f.section_id || null,
          }));
          setFields(parsedFields);
        }
        setSections((sectionsRes.data || []) as FormSection[]);
      }

      // Fetch Workflow Steps
      const { data: stepsData } = await supabase
        .from('request_workflow_steps')
        .select('*')
        .eq('request_id', id!)
        .order('step_order');

      if (stepsData?.length) {
        const approverIds = [...new Set(stepsData.filter(s => s.approved_by).map(s => s.approved_by))];
        const { data: approverProfiles } = await supabase.rpc('get_profiles_by_ids', { _ids: approverIds });

        const stepsWithNames = stepsData.map(s => ({
          ...s,
          approverName: s.approved_by ? approverProfiles?.find((p: any) => p.id === s.approved_by)?.name : undefined,
        }));
        setWorkflowSteps(stepsWithNames as (RequestWorkflowStep & { approverName?: string })[]);
      } else {
        setWorkflowSteps([]);
      }

      // Fetch history
      const { data: historyData } = await supabase
        .from('request_status_history').select('*').eq('request_id', id!)
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
      navigate('/review');
    } finally {
      setLoading(false);
    }
  };

  // Determine the current active level (lowest step_order with at least one pending)
  const getCurrentLevel = (): number | null => {
    const pendingSteps = workflowSteps.filter(s => s.status === 'pending');
    if (pendingSteps.length === 0) return null;
    return Math.min(...pendingSteps.map(s => s.step_order));
  };

  const currentLevel = getCurrentLevel();

  // All pending steps at the current level (parallel steps the user can act on)
  const currentLevelSteps = currentLevel !== null
    ? workflowSteps.filter(s => s.step_order === currentLevel && s.status === 'pending')
    : [];

  // The step the current user can act on (match by role)
  const myCurrentStep = currentLevelSteps.find(
    s => hasRole(s.role_name as any) || hasRole('administrador')
  ) || null;

  // Keep backward compat alias
  const currentStep = myCurrentStep;

  const canAct = !!(
    request?.status === 'en_revision' &&
    myCurrentStep
  );

  const openDialog = (selectedAction: ReviewAction) => {
    setAction(selectedAction);
    setComment('');
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!request || !user || !currentStep) return;
    if ((action === 'return' || action === 'reject') && !comment.trim()) {
      toast.error('El comentario es requerido');
      return;
    }

    setProcessing(true);
    try {
      // 1. Update current step
      if (action === 'approve') {
        const { error } = await supabase.from('request_workflow_steps')
          .update({
            status: 'approved',
            approved_by: user.id,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentStep.id);

        if (error) throw error;

        // Check if all parallel steps at this level are now approved
        const siblingSteps = workflowSteps.filter(s => s.step_order === currentStep.step_order && s.id !== currentStep.id);
        const allSiblingsApproved = siblingSteps.every(s => s.status === 'approved');

        // Check if there are steps at higher levels
        const hasNextLevel = workflowSteps.some(s => s.step_order > currentStep.step_order);

        if (allSiblingsApproved && !hasNextLevel) {
          // All steps at this level approved and no more levels -> Fully Approved
          await supabase.from('requests').update({ status: 'aprobada' }).eq('id', request.id);
          sendNotification({
            requestId: request.id,
            eventType: 'status_change',
            title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['aprobada']}`,
            message: `"${request.title}" ha sido aprobada y pasa a ejecución.`,
            triggeredBy: user.id,
            newStatus: 'aprobada',
          });
          toast.success('Solicitud completamente aprobada');
        } else {
          // Step approved, but either siblings pending or next level exists
          const msg = allSiblingsApproved
            ? `Nivel completado. Avanza al siguiente nivel.`
            : `Paso "${currentStep.label}" aprobado. Faltan aprobaciones en este nivel.`;
          sendNotification({
            requestId: request.id,
            eventType: 'status_change',
            title: `Solicitud #${formatRequestNumber(request.request_number)}: Paso aprobado`,
            message: `${profile?.name || 'Usuario'} aprobó el paso "${currentStep.label}".`,
            triggeredBy: user.id,
          });
          toast.success(msg);
        }
      }
      else if (action === 'reject') {
        await supabase.from('request_workflow_steps')
          .update({
            status: 'rejected',
            approved_by: user.id,
            comment: comment.trim() || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', currentStep.id);

        await supabase.from('requests').update({ status: 'rechazada' }).eq('id', request.id);

        sendNotification({
          requestId: request.id,
          eventType: 'status_change',
          title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['rechazada']}`,
          message: `${profile?.name || 'Usuario'} rechazó "${request.title}". Razón: ${comment}`,
          triggeredBy: user.id,
          newStatus: 'rechazada',
        });
        toast.success('Solicitud rechazada');
      }
      else if (action === 'return') {
        // Reset all steps to pending
        await supabase.from('request_workflow_steps')
          .update({ status: 'pending', approved_by: null, comment: null })
          .eq('request_id', request.id);

        await supabase.from('requests').update({ status: 'devuelta' }).eq('id', request.id);

        sendNotification({
          requestId: request.id,
          eventType: 'status_change',
          title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['devuelta']}`,
          message: `${profile?.name || 'Usuario'} devolvió "${request.title}". Razón: ${comment}`,
          triggeredBy: user.id,
          newStatus: 'devuelta',
        });
        toast.success('Solicitud devuelta');
      }

      // Record in history
      const siblingSteps2 = workflowSteps.filter(s => s.step_order === currentStep.step_order && s.id !== currentStep.id);
      const allSiblingsApproved2 = siblingSteps2.every(s => s.status === 'approved');
      const hasNextLevel2 = workflowSteps.some(s => s.step_order > currentStep.step_order);
      const fullyApproved = action === 'approve' && allSiblingsApproved2 && !hasNextLevel2;

      await supabase.from('request_status_history').insert({
        request_id: request.id,
        from_status: request.status,
        to_status: fullyApproved ? 'aprobada' :
          action === 'reject' ? 'rechazada' :
            action === 'return' ? 'devuelta' : request.status,
        changed_by: user.id,
        comment: `[${currentStep.label}] ${action === 'approve' ? 'Aprobado' : action === 'reject' ? 'Rechazado' : 'Devuelto'}: ${comment}`,
      });

      navigate('/review');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al procesar la acción');
    } finally {
      setProcessing(false);
      setDialogOpen(false);
    }
  };

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
    });
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

  const actionLabels: Record<ReviewAction, { title: string; description: string; buttonText: string }> = {
    approve: {
      title: 'Aprobar Paso',
      description: `¿Está seguro de aprobar el paso "${currentStep?.label}"?`,
      buttonText: 'Aprobar',
    },
    return: {
      title: 'Devolver Solicitud',
      description: 'Se reiniciarán todos los pasos de aprobación.',
      buttonText: 'Devolver',
    },
    reject: {
      title: 'Rechazar Solicitud',
      description: 'Esta acción rechazará permanentemente la solicitud.',
      buttonText: 'Rechazar',
    },
  };

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/review')}>
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
        <Button variant="outline" size="sm" onClick={handleExport}>
          <FileSpreadsheet className="w-4 h-4 mr-1" /> Excel
        </Button>
      </div>

      {/* Dynamic Workflow Progress Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Flujo de Aprobación</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {workflowSteps.length === 0 ? (
              <p className="text-muted-foreground">Este solicitud no tiene pasos de aprobación configurados.</p>
            ) : (
              (() => {
                // Group steps by step_order for parallel display
                const levels: Record<number, typeof workflowSteps> = {};
                workflowSteps.forEach(s => {
                  if (!levels[s.step_order]) levels[s.step_order] = [];
                  levels[s.step_order].push(s);
                });
                const sortedLevels = Object.keys(levels).map(Number).sort((a, b) => a - b);

                return (
                  <div className="space-y-3">
                    {sortedLevels.map((level, levelIdx) => {
                      const levelSteps = levels[level];
                      const isParallel = levelSteps.length > 1;
                      return (
                        <div key={level}>
                          <div className="text-xs font-semibold text-muted-foreground mb-1">
                            Nivel {levelIdx + 1}{isParallel ? ' (paralelo — todos deben aprobar)' : ''}
                          </div>
                          <div className={cn('grid gap-3', isParallel ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1')}>
                            {levelSteps.map((step) => {
                              const isMyStep = myCurrentStep?.id === step.id;
                              const isActiveLevel = currentLevel === step.step_order;
                              return (
                                <div
                                  key={step.id}
                                  className={cn(
                                    'p-4 rounded-lg border-2 transition-colors',
                                    step.status === 'approved' && 'border-emerald-300 bg-emerald-50',
                                    step.status === 'rejected' && 'border-red-300 bg-red-50',
                                    step.status === 'pending' && isMyStep && 'border-blue-300 bg-blue-50 ring-1 ring-blue-300',
                                    step.status === 'pending' && isActiveLevel && !isMyStep && 'border-amber-200 bg-amber-50/50',
                                    step.status === 'pending' && !isActiveLevel && 'border-muted bg-muted/30',
                                  )}
                                >
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-medium text-sm">{step.label}</span>
                                    {step.status === 'approved' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                                    {step.status === 'rejected' && <XCircle className="w-5 h-5 text-red-600" />}
                                    {step.status === 'pending' && <Clock className="w-5 h-5 text-muted-foreground" />}
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    {step.status === 'approved' && `Aprobado por ${step.approverName || 'Usuario'}`}
                                    {step.status === 'pending' && (isActiveLevel ? 'En espera de aprobación...' : 'Pendiente')}
                                  </p>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {canAct && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                Acción requerida: <span className="text-primary">{currentStep?.label}</span>
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => openDialog('return')}>
                  <RotateCcw className="w-4 h-4 mr-2" /> Devolver
                </Button>
                <Button variant="destructive" onClick={() => openDialog('reject')}>
                  <XCircle className="w-4 h-4 mr-2" /> Rechazar
                </Button>
                <Button onClick={() => openDialog('approve')}>
                  <CheckCircle className="w-4 h-4 mr-2" /> Aprobar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Form Data */}
      {fields.length > 0 && (
        <Card>
          <CardHeader><CardTitle>Datos de la Solicitud</CardTitle></CardHeader>
          <CardContent>
            <DynamicFormView fields={fields} sections={sections} values={request.data_json as Record<string, unknown>} />
          </CardContent>
        </Card>
      )}

      <RequestComments requestId={request.id} requestNumber={request.request_number} />

      {/* History */}
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
                        <MessageSquare className="w-3 h-3 mt-1 shrink-0" />
                        {entry.comment}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.created_at).toLocaleString('es-ES')}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{actionLabels[action].title}</DialogTitle>
            <DialogDescription>{actionLabels[action].description}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Label htmlFor="comment">
              Comentario {(action === 'return' || action === 'reject') && '*'}
            </Label>
            <Textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Escriba su comentario..."
              rows={3}
              className="mt-2"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={processing}>
              Cancelar
            </Button>
            <Button
              onClick={handleAction}
              disabled={processing}
              variant={action === 'reject' ? 'destructive' : 'default'}
            >
              {processing && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {actionLabels[action].buttonText}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
