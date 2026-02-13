import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { StatusBadge } from '@/components/ui/status-badge';
import { Request, RequestStatus } from '@/types/database';
import { RequestFilters, RequestFilterValues, defaultFilters } from '@/components/filters/RequestFilters';
import { Plus, Loader2, FileText, Eye, Users2 } from 'lucide-react';

export default function RequestsList() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<RequestFilterValues>(defaultFilters);
  const [userGroupIds, setUserGroupIds] = useState<string[]>([]);

  useEffect(() => {
    if (user) fetchUserGroups();
  }, [user]);

  useEffect(() => {
    fetchRequests();
  }, [user, filters]);

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

  const fetchRequests = async () => {
    if (!user) return;
    setLoading(true);

    try {
      let ownQuery = supabase.from('requests').select('*, form_templates(name), groups(name)')
        .eq('created_by', user.id).order('created_at', { ascending: false });
      ownQuery = applyFilters(ownQuery);
      const { data: ownData, error: ownError } = await ownQuery;
      if (ownError) throw ownError;

      const { data: groupIds } = await supabase.from('user_groups').select('group_id').eq('user_id', user.id);

      let groupData: Request[] = [];
      if (groupIds && groupIds.length > 0) {
        const gIds = groupIds.map((g) => g.group_id);
        let grpQuery = supabase.from('requests').select('*, form_templates(name), groups(name)')
          .in('group_id', gIds).order('created_at', { ascending: false });
        grpQuery = applyFilters(grpQuery);
        const { data, error } = await grpQuery;
        if (error) throw error;
        groupData = (data || []) as Request[];
      }

      const allMap = new Map<string, Request>();
      for (const r of (ownData || []) as Request[]) allMap.set(r.id, r);
      for (const r of groupData) allMap.set(r.id, r);
      const all = Array.from(allMap.values()).sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      setRequests(all);
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading && requests.length === 0) {
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
          <h1 className="text-2xl font-bold">Solicitudes</h1>
          <p className="text-muted-foreground">Sus solicitudes y las de su grupo</p>
        </div>
        <Link to="/requests/new">
          <Button><Plus className="w-4 h-4 mr-2" /> Nueva Solicitud</Button>
        </Link>
      </div>

      <RequestFilters filters={filters} onChange={setFilters} userGroupIds={userGroupIds} />

      {requests.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin solicitudes</h3>
            <p className="text-muted-foreground mb-4">
              {filters.status !== 'all' || filters.dateFrom || filters.dateTo || filters.groupId !== 'all' || filters.templateId !== 'all'
                ? 'No hay solicitudes con los filtros seleccionados'
                : 'Cree su primera solicitud para comenzar'}
            </p>
            {filters.status === 'all' && !filters.dateFrom && !filters.dateTo && filters.groupId === 'all' && filters.templateId === 'all' && (
              <Link to="/requests/new">
                <Button><Plus className="w-4 h-4 mr-2" /> Crear Solicitud</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {requests.map((request) => (
            <Card key={request.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="text-xs font-mono text-muted-foreground">#{String(request.request_number).padStart(6, '0')}</span>
                      <h3 className="font-semibold">{request.title}</h3>
                      <StatusBadge status={request.status as RequestStatus} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {(request as any).form_templates?.name && (
                        <span className="font-medium text-foreground/70 mr-2">{(request as any).form_templates.name} ·</span>
                      )}
                      {(request as any).groups?.name && (
                        <span className="inline-flex items-center gap-1 mr-2"><Users2 className="w-3 h-3" />{(request as any).groups.name} ·</span>
                      )}
                      Creada: {new Date(request.created_at).toLocaleDateString('es-ES', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/requests/${request.id}`}>
                      <Button variant="outline" size="sm"><Eye className="w-4 h-4 mr-2" /> Ver</Button>
                    </Link>
                    {(request.status === 'borrador' || request.status === 'devuelta') && (
                      <Link to={`/requests/${request.id}/edit`}>
                        <Button size="sm">Editar</Button>
                      </Link>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
