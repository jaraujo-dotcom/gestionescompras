import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Request, RequestStatus, Profile, RequestApproval, APPROVAL_ROLE_LABELS } from '@/types/database';
import { Loader2, ClipboardCheck, Eye, CheckCircle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RequestWithCreator extends Request {
  creator?: Profile;
  approvals?: RequestApproval[];
}

export default function ReviewList() {
  const { hasRole } = useAuth();
  const [requests, setRequests] = useState<RequestWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPendingReviews();
  }, []);

  const fetchPendingReviews = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .eq('status', 'en_revision')
        .order('created_at', { ascending: true });

      if (error) throw error;

      if (data && data.length > 0) {
        const requestIds = data.map(r => r.id);
        const creatorIds = [...new Set(data.map((r) => r.created_by))];

        const [profilesRes, approvalsRes] = await Promise.all([
          supabase.rpc('get_profiles_by_ids', { _ids: creatorIds }),
          supabase.from('request_approvals').select('*').in('request_id', requestIds),
        ]);

        const requestsWithData = data.map((r) => ({
          ...r,
          data_json: r.data_json as Record<string, unknown>,
          status: r.status as RequestStatus,
          creator: profilesRes.data?.find((p: { id: string; name: string }) => p.id === r.created_by) as Profile | undefined,
          approvals: (approvalsRes.data || []).filter(a => a.request_id === r.id) as RequestApproval[],
        }));
        setRequests(requestsWithData as RequestWithCreator[]);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const getApprovalSummary = (approvals: RequestApproval[] = []) => {
    const roles = ['gerencia', 'procesos', 'integridad_datos'] as const;
    return roles.map(role => {
      const approval = approvals.find(a => a.role === role);
      return {
        role,
        label: APPROVAL_ROLE_LABELS[role],
        status: approval?.status || 'pendiente',
      };
    });
  };

  const canUserActOnRequest = (approvals: RequestApproval[] = []) => {
    const gerenciaApproval = approvals.find(a => a.role === 'gerencia');
    const gerenciaApproved = gerenciaApproval?.status === 'aprobada';

    if (hasRole('gerencia') && (!gerenciaApproval || gerenciaApproval.status === 'pendiente')) return true;
    if (gerenciaApproved) {
      if (hasRole('procesos')) {
        const pa = approvals.find(a => a.role === 'procesos');
        if (!pa || pa.status === 'pendiente') return true;
      }
      if (hasRole('integridad_datos')) {
        const ia = approvals.find(a => a.role === 'integridad_datos');
        if (!ia || ia.status === 'pendiente') return true;
      }
    }
    return hasRole('administrador');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bandeja de Aprobación</h1>
        <p className="text-muted-foreground">Solicitudes pendientes de aprobación</p>
      </div>

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin solicitudes pendientes</h3>
            <p className="text-muted-foreground">
              No hay solicitudes que requieran aprobación
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => {
            const summary = getApprovalSummary(request.approvals);
            const canAct = canUserActOnRequest(request.approvals);

            return (
              <Card key={request.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="text-xs font-mono text-muted-foreground">
                          #{String(request.request_number).padStart(6, '0')}
                        </span>
                        <h3 className="font-semibold">{request.title}</h3>
                        <StatusBadge status={request.status as RequestStatus} />
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground mb-2">
                        <span>Solicitante: {request.creator?.name || 'Desconocido'}</span>
                        <span>•</span>
                        <span>
                          {new Date(request.created_at).toLocaleDateString('es-ES', {
                            day: '2-digit', month: 'short', year: 'numeric',
                          })}
                        </span>
                      </div>
                      {/* Approval progress */}
                      <div className="flex items-center gap-3">
                        {summary.map(s => (
                          <span
                            key={s.role}
                            className={cn(
                              'inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full',
                              s.status === 'aprobada' && 'bg-emerald-100 text-emerald-700',
                              s.status === 'pendiente' && 'bg-muted text-muted-foreground',
                              s.status === 'rechazada' && 'bg-red-100 text-red-700',
                              s.status === 'devuelta' && 'bg-amber-100 text-amber-700',
                            )}
                          >
                            {s.status === 'aprobada' ? (
                              <CheckCircle className="w-3 h-3" />
                            ) : (
                              <Clock className="w-3 h-3" />
                            )}
                            {s.label}
                          </span>
                        ))}
                      </div>
                    </div>
                    <Link to={`/review/${request.id}`}>
                      <Button variant={canAct ? 'default' : 'outline'}>
                        <Eye className="w-4 h-4 mr-2" />
                        {canAct ? 'Aprobar' : 'Ver'}
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
