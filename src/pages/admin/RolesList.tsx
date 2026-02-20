import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { ArrowLeft, Pencil, Loader2, ShieldAlert } from 'lucide-react';
import { toast } from 'sonner';

interface RoleDefinition {
    id: string;
    role_key: string;
    display_name: string;
    description: string | null;
    can_approve: boolean;
    is_system: boolean;
}

export default function RolesList() {
    const navigate = useNavigate();
    const [roles, setRoles] = useState<RoleDefinition[]>([]);
    const [loading, setLoading] = useState(true);
    const [editRole, setEditRole] = useState<RoleDefinition | null>(null);
    const [saving, setSaving] = useState(false);

    useEffect(() => { fetchRoles(); }, []);

    const fetchRoles = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('role_definitions')
                .select('*')
                .order('is_system', { ascending: false })
                .order('display_name');
            if (error) throw error;
            setRoles(data || []);
        } catch (error) {
            console.error(error);
            toast.error('Error al cargar los roles');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleApprove = async (role: RoleDefinition) => {
        try {
            const { error } = await supabase
                .from('role_definitions')
                .update({ can_approve: !role.can_approve })
                .eq('id', role.id);
            if (error) throw error;
            setRoles(prev => prev.map(r => r.id === role.id ? { ...r, can_approve: !r.can_approve } : r));
        } catch (error) {
            toast.error('Error al actualizar el rol');
        }
    };

    const handleSaveEdit = async () => {
        if (!editRole) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('role_definitions')
                .update({
                    display_name: editRole.display_name,
                    description: editRole.description,
                })
                .eq('id', editRole.id);
            if (error) throw error;
            toast.success('Rol actualizado');
            setEditRole(null);
            fetchRoles();
        } catch (error) {
            toast.error('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <div>
                    <h1 className="text-2xl font-bold">Gestión de Roles</h1>
                    <p className="text-sm text-muted-foreground">Configura etiquetas y permisos de aprobación por rol</p>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Roles del Sistema</CardTitle>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="flex justify-center py-8">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Nombre Visible</TableHead>
                                    <TableHead>Clave</TableHead>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="text-center">Puede Aprobar</TableHead>
                                    <TableHead className="text-center">Tipo</TableHead>
                                    <TableHead></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {roles.map(role => (
                                    <TableRow key={role.id}>
                                        <TableCell className="font-medium">{role.display_name}</TableCell>
                                        <TableCell>
                                            <code className="text-xs bg-muted px-2 py-0.5 rounded">{role.role_key}</code>
                                        </TableCell>
                                        <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                                            {role.description || '-'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                            <Switch
                                                checked={role.can_approve}
                                                onCheckedChange={() => handleToggleApprove(role)}
                                            />
                                        </TableCell>
                                        <TableCell className="text-center">
                                            {role.is_system
                                                ? <Badge variant="secondary">Sistema</Badge>
                                                : <Badge>Custom</Badge>}
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" onClick={() => setEditRole({ ...role })}>
                                                <Pencil className="w-4 h-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </CardContent>
            </Card>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50 border text-sm text-muted-foreground">
                <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
                <p>
                    Los roles del sistema son definidos en la base de datos y no pueden eliminarse desde aquí.
                    Para agregar un nuevo rol personalizado, contacta al administrador de Base de Datos.
                </p>
            </div>

            {/* Edit Dialog */}
            <Dialog open={!!editRole} onOpenChange={(o) => !o && setEditRole(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Editar Rol: {editRole?.role_key}</DialogTitle>
                    </DialogHeader>
                    {editRole && (
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label>Nombre Visible</Label>
                                <Input
                                    value={editRole.display_name}
                                    onChange={e => setEditRole({ ...editRole, display_name: e.target.value })}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label>Descripción</Label>
                                <Textarea
                                    value={editRole.description || ''}
                                    onChange={e => setEditRole({ ...editRole, description: e.target.value })}
                                    rows={3}
                                />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setEditRole(null)}>Cancelar</Button>
                        <Button onClick={handleSaveEdit} disabled={saving}>
                            {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                            Guardar
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
