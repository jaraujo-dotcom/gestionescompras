import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { RequestStatus, Request, STATUS_LABELS } from '@/types/database';
import { RequestFilters, RequestFilterValues, defaultFilters } from '@/components/filters/RequestFilters';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  FileText, Plus, ClipboardCheck, PlayCircle, Eye, Loader2, Users2,
} from 'lucide-react';

interface DashboardStats {
  myRequests: number;
  pendingReview: number;
  pendingExecution: number;
  inExecution: number;
  groupRequests: number;
}

export default function Dashboard() {
  const { profile, hasRole, user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    myRequests: 0, pendingReview: 0, pendingExecution: 0, inExecution: 0, groupRequests: 0,
  });
  const [recentRequests, setRecentRequests] = useState<Request[]>([]);
  const [groupRequests, setGroupRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RequestFilterValues>(defaultFilters);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  useEffect(() => {
    if (user) fetchUserGroups();
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [filters, userGroupIds]);

  const fetchUserGroups = async () => {
    if (!user) return;
    const { data } = await supabase.from('user_groups').select('group_id').eq('user_id', user.id);
    if (data) setUserGroupIds(data.map((d) => d.group_id));
  };

  const applyFilters = (query: any) => {
    if (filters.status !== 'all') query = query.eq('status', filters.status);
    if (filters.groupId !== 'all') query = query.eq('group_id', filters.groupId);
    if (filters.templateId !== 'all') query = query.eq('template_id', filters.templateId);
    if (filters.dateFrom) query = query.gte('created_at', filters.dateFrom.toISOString());
    if (filters.dateTo) {
      const end = new Date(filters.dateTo);
      end.setHours(23, 59, 59, 999);
      query = query.lte('created_at', end.toISOString());
    }
    return query;
  };

  const fetchDashboardData = async () => {
    if (!user) return;
    try {
      let query = supabase.from('requests').select('*, form_templates(name), groups(name)')
        .order('created_at', { ascending: false }).limit(50);
      query = applyFilters(query);
      const { data: requests } = await query;

      let grpReqs: Request[] = [];
      if (userGroupIds.length > 0) {
        let grpQuery = supabase.from('requests').select('*, form_templates(name), groups(name)')
          .in('group_id', userGroupIds).order('created_at', { ascending: false }).limit(50);
        grpQuery = applyFilters(grpQuery);
        const { data: grpData } = await grpQuery;
        grpReqs = (grpData || []) as Request[];
      }

      if (requests) {
        setRecentRequests(requests as Request[]);
        setGroupRequests(grpReqs);
        const noFilters = filters.status === 'all' && !filters.dateFrom && !filters.dateTo && filters.groupId === 'all' && filters.templateId === 'all';
        if (noFilters) {
          const myReqs = requests.filter((r) => r.created_by === user.id);
          setStats({
            myRequests: myReqs.length,
            pendingReview: requests.filter((r) => r.status === 'en_revision').length,
            pendingExecution: requests.filter((r) => r.status === 'aprobada').length,
            inExecution: requests.filter((r) => r.status === 'en_ejecucion').length,
            groupRequests: grpReqs.length,
          });
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
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bienvenido, {profile?.name}</h1>
          <p className="text-muted-foreground">Panel de control del sistema de solicitudes</p>
        </div>
        {(hasRole('solicitante') || hasRole('administrador')) && (
          <Link to="/requests/new">
            <Button><Plus className="w-4 h-4 mr-2" /> Nueva Solicitud</Button>
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
              <Link to="/requests" className="text-xs text-primary hover:underline">Ver todas</Link>
            </CardContent>
          </Card>
        )}
        {userGroupIds.length > 0 && (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Del Grupo</CardTitle>
              <Users2 className="w-4 h-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.groupRequests}</div>
              <p className="text-xs text-muted-foreground">Solicitudes de mi grupo</p>
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
              <Link to="/review" className="text-xs text-primary hover:underline">Revisar</Link>
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
                <Link to="/execution" className="text-xs text-primary hover:underline">Ver</Link>
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

      {/* Requests with filters */}
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>Solicitudes</CardTitle>
          <RequestFilters filters={filters} onChange={setFilters} />
        </CardHeader>
        <CardContent>
          {userGroupIds.length > 0 ? (
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-3">
                <TabsTrigger value="all">Todas</TabsTrigger>
                <TabsTrigger value="group">Mi Grupo ({groupRequests.length})</TabsTrigger>
              </TabsList>
              <TabsContent value="all">{renderRequestsList(recentRequests)}</TabsContent>
              <TabsContent value="group">{renderRequestsList(groupRequests)}</TabsContent>
            </Tabs>
          ) : (
            renderRequestsList(recentRequests)
          )}
        </CardContent>
      </Card>
    </div>
  );

  function renderRequestsList(requests: Request[]) {
    if (requests.length === 0) {
      return <p className="text-muted-foreground text-center py-4">No hay solicitudes</p>;
    }
    return (
      <div className="space-y-3">
        {requests.map((request) => (
          <Link key={request.id} to={`/requests/${request.id}`}
            className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
            <div>
              <p className="font-medium">
                <span className="text-xs font-mono text-muted-foreground mr-2">#{String((request as any).request_number).padStart(6, '0')}</span>
                {request.title}
              </p>
              <p className="text-sm text-muted-foreground">
                {(request as any).form_templates?.name && (
                  <span className="mr-2">{(request as any).form_templates.name} ·</span>
                )}
                {(request as any).groups?.name && (
                  <span className="mr-2 inline-flex items-center gap-1"><Users2 className="w-3 h-3" />{(request as any).groups.name} ·</span>
                )}
                {new Date(request.created_at).toLocaleDateString('es-ES')}
              </p>
            </div>
            <StatusBadge status={request.status as RequestStatus} />
          </Link>
        ))}
      </div>
    );
  }
}
