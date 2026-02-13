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
  TableColumnSchema, STATUS_LABELS, RequestApproval,
  APPROVAL_ROLE_LABELS,
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
  const [approvals, setApprovals] = useState<(RequestApproval & { approverName?: string })[]>([]);
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

      // Fetch approvals
      const { data: approvalsData } = await supabase
        .from('request_approvals').select('*').eq('request_id', id!);

      if (approvalsData?.length) {
        const approverIds = [...new Set(approvalsData.map(a => a.approved_by))];
        const { data: approverProfiles } = await supabase.rpc('get_profiles_by_ids', { _ids: approverIds });
        const approvalsWithNames = approvalsData.map(a => ({
          ...a,
          approverName: approverProfiles?.find((p: { id: string; name: string }) => p.id === a.approved_by)?.name,
        }));
        setApprovals(approvalsWithNames as (RequestApproval & { approverName?: string })[]);
      } else {
        setApprovals([]);
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

  // Determine which approval role the current user can act as
  const getUserApprovalRole = (): string | null => {
    const isAdmin = hasRole('administrador');
    const gerenciaApproval = approvals.find(a => a.role === 'gerencia');
    const gerenciaApproved = gerenciaApproval?.status === 'aprobada';

    // Gerencia goes first
    if ((hasRole('gerencia') || isAdmin) && (!gerenciaApproval || gerenciaApproval.status === 'pendiente')) {
      return 'gerencia';
    }

    // After gerencia approves, procesos and integridad_datos can act
    if (gerenciaApproved) {
      if (hasRole('procesos') || isAdmin) {
        const pa = approvals.find(a => a.role === 'procesos');
        if (!pa || pa.status === 'pendiente') return 'procesos';
      }
      if (hasRole('integridad_datos') || isAdmin) {
        const ia = approvals.find(a => a.role === 'integridad_datos');
        if (!ia || ia.status === 'pendiente') return 'integridad_datos';
      }
    }

    return null;
  };

  const userApprovalRole = request?.status === 'en_revision' ? getUserApprovalRole() : null;
  const canAct = !!userApprovalRole;

  const openDialog = (selectedAction: ReviewAction) => {
    setAction(selectedAction);
    setComment('');
    setDialogOpen(true);
  };

  const handleAction = async () => {
    if (!request || !user || !userApprovalRole) return;
    if ((action === 'return' || action === 'reject') && !comment.trim()) {
      toast.error('El comentario es requerido');
      return;
    }

    setProcessing(true);
    try {
      const approvalStatus = action === 'approve' ? 'aprobada' : action === 'reject' ? 'rechazada' : 'devuelta';

      // Upsert the approval record
      const existingApproval = approvals.find(a => a.role === userApprovalRole);
      if (existingApproval) {
        await supabase.from('request_approvals')
          .update({ status: approvalStatus, approved_by: user.id, comment: comment.trim() || null })
          .eq('id', existingApproval.id);
      } else {
        await supabase.from('request_approvals').insert({
          request_id: request.id,
          role: userApprovalRole,
          approved_by: user.id,
          status: approvalStatus,
          comment: comment.trim() || null,
        });
      }

      // Record in status history
      await supabase.from('request_status_history').insert({
        request_id: request.id,
        from_status: request.status,
        to_status: request.status, // stays en_revision unless final
        changed_by: user.id,
        comment: `[${APPROVAL_ROLE_LABELS[userApprovalRole]}] ${action === 'approve' ? 'Aprobó' : action === 'reject' ? 'Rechazó' : 'Devolvió'}${comment.trim() ? `: ${comment.trim()}` : ''}`,
      });

      // If rejected → request becomes rechazada
      if (action === 'reject') {
        await supabase.from('requests').update({ status: 'rechazada' }).eq('id', request.id);
        await supabase.from('request_status_history').insert({
          request_id: request.id,
          from_status: 'en_revision',
          to_status: 'rechazada',
          changed_by: user.id,
          comment: `Solicitud rechazada por ${APPROVAL_ROLE_LABELS[userApprovalRole]}`,
        });

        sendNotification({
          requestId: request.id,
          eventType: 'status_change',
          title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['rechazada']}`,
          message: `${profile?.name || 'Usuario'} (${APPROVAL_ROLE_LABELS[userApprovalRole]}) rechazó "${request.title}".${comment.trim() ? ` Comentario: ${comment.trim()}` : ''}`,
          triggeredBy: user.id,
          newStatus: 'rechazada',
        });
        toast.success('Solicitud rechazada');
      }
      // If returned → request becomes devuelta and approvals reset
      else if (action === 'return') {
        await supabase.from('requests').update({ status: 'devuelta' }).eq('id', request.id);
        // Delete all approvals so they start fresh on resubmission
        await supabase.from('request_approvals').delete().eq('request_id', request.id);

        await supabase.from('request_status_history').insert({
          request_id: request.id,
          from_status: 'en_revision',
          to_status: 'devuelta',
          changed_by: user.id,
          comment: `Solicitud devuelta por ${APPROVAL_ROLE_LABELS[userApprovalRole]}`,
        });

        sendNotification({
          requestId: request.id,
          eventType: 'status_change',
          title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['devuelta']}`,
          message: `${profile?.name || 'Usuario'} (${APPROVAL_ROLE_LABELS[userApprovalRole]}) devolvió "${request.title}".${comment.trim() ? ` Comentario: ${comment.trim()}` : ''}`,
          triggeredBy: user.id,
          newStatus: 'devuelta',
        });
        toast.success('Solicitud devuelta al solicitante');
      }
      // If approved → check if all 3 are now approved
      else {
        // Re-fetch approvals to check status
        const { data: latestApprovals } = await supabase
          .from('request_approvals').select('*').eq('request_id', request.id);

        const allApproved = ['gerencia', 'procesos', 'integridad_datos'].every(role =>
          latestApprovals?.some(a => a.role === role && a.status === 'aprobada')
        );

        if (allApproved) {
          await supabase.from('requests').update({ status: 'aprobada' }).eq('id', request.id);
          await supabase.from('request_status_history').insert({
            request_id: request.id,
            from_status: 'en_revision',
            to_status: 'aprobada',
            changed_by: user.id,
            comment: 'Todas las aprobaciones completadas',
          });

          sendNotification({
            requestId: request.id,
            eventType: 'status_change',
            title: `Solicitud #${formatRequestNumber(request.request_number)}: ${STATUS_LABELS['aprobada']}`,
            message: `"${request.title}" ha sido aprobada por las 3 áreas y pasa a ejecución.`,
            triggeredBy: user.id,
            newStatus: 'aprobada',
          });
          toast.success('Solicitud completamente aprobada');
        } else {
          sendNotification({
            requestId: request.id,
            eventType: 'status_change',
            title: `Solicitud #${formatRequestNumber(request.request_number)}: Aprobación parcial`,
            message: `${profile?.name || 'Usuario'} (${APPROVAL_ROLE_LABELS[userApprovalRole]}) aprobó "${request.title}".`,
            triggeredBy: user.id,
          });
          toast.success(`Aprobación de ${APPROVAL_ROLE_LABELS[userApprovalRole]} registrada`);
        }
      }

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
      title: 'Aprobar Solicitud',
      description: `¿Está seguro de aprobar esta solicitud como ${APPROVAL_ROLE_LABELS[userApprovalRole || ''] || ''}?`,
      buttonText: 'Aprobar',
    },
    return: {
      title: 'Devolver Solicitud',
      description: 'Indique el motivo de la devolución para que el solicitante corrija. Se reiniciarán todas las aprobaciones previas.',
      buttonText: 'Devolver',
    },
    reject: {
      title: 'Rechazar Solicitud',
      description: 'Indique el motivo del rechazo. Esta acción no se puede deshacer.',
      buttonText: 'Rechazar',
    },
  };

  const getApprovalStatusForRole = (role: string) => {
    const approval = approvals.find(a => a.role === role);
    return approval?.status || 'pendiente';
  };

  const approvalRoles = [
    { role: 'gerencia', label: 'Gerencia', order: 1 },
    { role: 'procesos', label: 'Procesos', order: 2 },
    { role: 'integridad_datos', label: 'Integridad de Datos', order: 3 },
  ];

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

      {/* Approval Progress Panel */}
      <Card>
        <CardHeader>
          <CardTitle>Estado de Aprobaciones</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {approvalRoles.map(({ role, label, order }) => {
              const status = getApprovalStatusForRole(role);
              const approval = approvals.find(a => a.role === role);
              const gerenciaStatus = getApprovalStatusForRole('gerencia');
              const isBlocked = order > 1 && gerenciaStatus !== 'aprobada';

              return (
                <div
                  key={role}
                  className={cn(
                    'p-4 rounded-lg border-2 transition-colors',
                    status === 'aprobada' && 'border-emerald-300 bg-emerald-50',
                    status === 'rechazada' && 'border-red-300 bg-red-50',
                    status === 'devuelta' && 'border-amber-300 bg-amber-50',
                    status === 'pendiente' && !isBlocked && 'border-blue-200 bg-blue-50',
                    status === 'pendiente' && isBlocked && 'border-muted bg-muted/30',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-sm">{order}. {label}</span>
                    {status === 'aprobada' && <CheckCircle className="w-5 h-5 text-emerald-600" />}
                    {status === 'rechazada' && <XCircle className="w-5 h-5 text-red-600" />}
                    {status === 'devuelta' && <RotateCcw className="w-5 h-5 text-amber-600" />}
                    {status === 'pendiente' && <Clock className="w-5 h-5 text-muted-foreground" />}
                  </div>
                  <p className={cn(
                    'text-xs',
                    status === 'aprobada' && 'text-emerald-700',
                    status === 'rechazada' && 'text-red-700',
                    status === 'devuelta' && 'text-amber-700',
                    status === 'pendiente' && 'text-muted-foreground',
                  )}>
                    {status === 'aprobada' && `Aprobado por ${approval?.approverName || 'Usuario'}`}
                    {status === 'rechazada' && `Rechazado por ${approval?.approverName || 'Usuario'}`}
                    {status === 'devuelta' && `Devuelto por ${approval?.approverName || 'Usuario'}`}
                    {status === 'pendiente' && (isBlocked ? 'Esperando aprobación de Gerencia' : 'Pendiente')}
                  </p>
                  {approval?.comment && (
                    <p className="text-xs mt-1 text-muted-foreground italic">"{approval.comment}"</p>
                  )}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      {canAct && request.status === 'en_revision' && (
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-medium">
                Aprobación como <span className="text-primary">{APPROVAL_ROLE_LABELS[userApprovalRole!]}</span>
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
