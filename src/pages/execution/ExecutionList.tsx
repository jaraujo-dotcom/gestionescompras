import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { StatusBadge } from '@/components/ui/status-badge';
import { Request, RequestStatus, Profile } from '@/types/database';
import { Loader2, PlayCircle, Eye } from 'lucide-react';

interface RequestWithCreator extends Request {
  creator?: Profile;
}

export default function ExecutionList() {
  const [requests, setRequests] = useState<RequestWithCreator[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'aprobada' | 'en_ejecucion' | 'en_espera'>('aprobada');

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const { data, error } = await supabase
        .from('requests')
        .select('*')
        .in('status', ['aprobada', 'en_ejecucion', 'en_espera'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        const creatorIds = [...new Set(data.map((r) => r.created_by))];
        const { data: profiles } = await supabase
          .from('profiles')
          .select('*')
          .in('id', creatorIds);

        const requestsWithCreators = data.map((r) => ({
          ...r,
          creator: profiles?.find((p) => p.id === r.created_by),
        }));
        setRequests(requestsWithCreators as RequestWithCreator[]);
      } else {
        setRequests([]);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter((r) => r.status === activeTab);

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
        <h1 className="text-2xl font-bold">Bandeja de Ejecución</h1>
        <p className="text-muted-foreground">Solicitudes aprobadas y en proceso</p>
      </div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'aprobada' | 'en_ejecucion' | 'en_espera')}>
        <TabsList>
          <TabsTrigger value="aprobada">
            Aprobadas ({requests.filter((r) => r.status === 'aprobada').length})
          </TabsTrigger>
          <TabsTrigger value="en_ejecucion">
            En Ejecución ({requests.filter((r) => r.status === 'en_ejecucion').length})
          </TabsTrigger>
          <TabsTrigger value="en_espera">
            En Espera ({requests.filter((r) => r.status === 'en_espera').length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {filteredRequests.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <PlayCircle className="w-12 h-12 text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">Sin solicitudes</h3>
                <p className="text-muted-foreground">
                  No hay solicitudes {activeTab === 'aprobada' ? 'aprobadas' : 'en ejecución'}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {filteredRequests.map((request) => (
                <Card key={request.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <span className="text-xs font-mono text-muted-foreground">#{String((request as any).request_number).padStart(6, '0')}</span>
                          <h3 className="font-semibold">{request.title}</h3>
                          <StatusBadge status={request.status as RequestStatus} />
                        </div>
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <span>Solicitante: {request.creator?.name || 'Desconocido'}</span>
                          <span>•</span>
                          <span>
                            {new Date(request.updated_at).toLocaleDateString('es-ES', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}
                          </span>
                        </div>
                      </div>
                      <Link to={`/execution/${request.id}`}>
                        <Button>
                          <Eye className="w-4 h-4 mr-2" />
                          {activeTab === 'aprobada' ? 'Ejecutar' : 'Ver'}
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
