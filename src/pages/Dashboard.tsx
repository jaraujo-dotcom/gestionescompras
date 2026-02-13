import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { RequestStatus, Request, STATUS_LABELS } from '@/types/database';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  FileText,
  Plus,
  ClipboardCheck,
  PlayCircle,
  Eye,
  Loader2,
  Filter,
} from 'lucide-react';

interface DashboardStats {
  myRequests: number;
  pendingReview: number;
  pendingExecution: number;
  inExecution: number;
}

const ALL_STATUSES: RequestStatus[] = [
  'borrador', 'en_revision', 'devuelta', 'aprobada',
  'en_ejecucion', 'en_espera', 'completada', 'rechazada', 'anulada',
];

export default function Dashboard() {
  const { profile, hasRole } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    myRequests: 0,
    pendingReview: 0,
    pendingExecution: 0,
    inExecution: 0,
  });
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  useEffect(() => {
    fetchDashboardData();
  }, [statusFilter]);

  const fetchDashboardData = async () => {
    try {
      let query = supabase
        .from('requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter as RequestStatus);
      }

      query = query.limit(20);

      const { data: requests } = await query;

      if (requests) {
        setRecentRequests(requests as Request[]);

        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          // Stats always unfiltered — fetch separately only on first load
          if (statusFilter === 'all') {
            const myReqs = requests.filter((r) => r.created_by === user.id);
            setStats({
              myRequests: myReqs.length,
              pendingReview: requests.filter((r) => r.status === 'en_revision').length,
              pendingExecution: requests.filter((r) => r.status === 'aprobada').length,
              inExecution: requests.filter((r) => r.status === 'en_ejecucion').length,
            });
          }
        }
      }
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bienvenido, {profile?.name}</h1>
          <p className="text-muted-foreground">Panel de control del sistema de solicitudes</p>
        </div>
        {(hasRole('solicitante') || hasRole('administrador')) && (
          <Link to="/requests/new">
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nueva Solicitud
            </Button>
          </Link>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {(hasRole('solicitante') || hasRole('administrador')) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Mis Solicitudes</CardTitle>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.myRequests}</div>
              <Link to="/requests" className="text-xs text-primary hover:underline">
                Ver todas
              </Link>
            </CardContent>
          </Card>
        )}

        {(hasRole('gerencia') || hasRole('procesos') || hasRole('integridad_datos') || hasRole('administrador')) && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Pendientes de Aprobación</CardTitle>
              <ClipboardCheck className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.pendingReview}</div>
              <Link to="/review" className="text-xs text-primary hover:underline">
                Revisar
              </Link>
            </CardContent>
          </Card>
        )}

        {(hasRole('ejecutor') || hasRole('administrador')) && (
          <>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">Aprobadas</CardTitle>
                <PlayCircle className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.pendingExecution}</div>
                <Link to="/execution" className="text-xs text-primary hover:underline">
                  Ver
                </Link>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">En Ejecución</CardTitle>
                <Eye className="w-4 h-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stats.inExecution}</div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Recent Requests */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Solicitudes Recientes</CardTitle>
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-muted-foreground" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px] h-8 text-sm">
                <SelectValue placeholder="Filtrar por estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                {ALL_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {recentRequests.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No hay solicitudes {statusFilter !== 'all' ? 'con este estado' : 'aún'}
            </p>
          ) : (
            <div className="space-y-3">
              {recentRequests.map((request) => (
                <Link
                  key={request.id}
                  to={`/requests/${request.id}`}
                  className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                >
                  <div>
                    <p className="font-medium">
                      <span className="text-xs font-mono text-muted-foreground mr-2">#{String((request as any).request_number).padStart(6, '0')}</span>
                      {request.title}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(request.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <StatusBadge status={request.status as RequestStatus} />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
