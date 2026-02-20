import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table';
import { Plus, Edit, Trash2, ArrowLeft, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowTemplate } from '@/types/database';

export default function WorkflowList() {
    const navigate = useNavigate();
    const [workflows, setWorkflows] = useState<WorkflowTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchWorkflows();
    }, []);

    const fetchWorkflows = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('workflow_templates')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            setWorkflows(data || []);
        } catch (error) {
            console.error('Error fetching workflows:', error);
            toast.error('Error al cargar flujos de trabajo');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Está seguro de eliminar este flujo? Esto podría afectar plantillas existentes.')) return;

        try {
            const { error } = await supabase
                .from('workflow_templates')
                .delete()
                .eq('id', id);

            if (error) throw error;

            toast.success('Flujo eliminado correctamente');
            fetchWorkflows();
        } catch (error) {
            console.error('Error deleting workflow:', error);
            toast.error('Error al eliminar el flujo');
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-5xl mx-auto">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                        <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <h1 className="text-2xl font-bold">Flujos de Aprobación</h1>
                </div>
                <Link to="/admin/workflows/new">
                    <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Nuevo Flujo
                    </Button>
                </Link>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Flujos Configurados</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : workflows.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No hay flujos configurados.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-right">Acciones</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {workflows.map((workflow) => (
                                    <TableRow key={workflow.id}>
                                        <TableCell className="font-medium">{workflow.name}</TableCell>
                                        <TableCell>{workflow.description || '-'}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    onClick={() => navigate(`/admin/workflows/${workflow.id}`)}
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="icon"
                                                    className="text-destructive hover:text-destructive"
                                                    onClick={() => handleDelete(workflow.id)}
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
