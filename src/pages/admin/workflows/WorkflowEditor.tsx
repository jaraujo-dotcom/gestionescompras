import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Table, TableBody, TableCell, TableHead,
    TableHeader, TableRow,
} from '@/components/ui/table';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Save, Loader2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowTemplate, WorkflowStep, APPROVAL_ROLES } from '@/types/database';

export default function WorkflowEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState<Partial<WorkflowStep>[]>([]);

    const isEditing = !!id;

    useEffect(() => {
        if (id) fetchWorkflow();
    }, [id]);

    const fetchWorkflow = async () => {
        try {
            setLoading(true);
            // Fetch Template
            const { data: template, error: templateError } = await supabase
                .from('workflow_templates')
                .select('*')
                .eq('id', id)
                .single();

            if (templateError) throw templateError;

            setName(template.name);
            setDescription(template.description || '');

            // Fetch Steps
            const { data: stepsData, error: stepsError } = await supabase
                .from('workflow_steps')
                .select('*')
                .eq('workflow_id', id)
                .order('step_order');

            if (stepsError) throw stepsError;

            setSteps(stepsData || []);
        } catch (error) {
            console.error('Error fetching workflow:', error);
            toast.error('Error al cargar el flujo');
            navigate('/admin/workflows');
        } finally {
            setLoading(false);
        }
    };

    const addStep = () => {
        setSteps([
            ...steps,
            {
                step_order: steps.length + 1,
                role_name: 'gerencia',
                label: `Aprobación ${steps.length + 1}`,
            },
        ]);
    };

    const removeStep = (index: number) => {
        const newSteps = steps.filter((_, i) => i !== index).map((step, i) => ({
            ...step,
            step_order: i + 1,
        }));
        setSteps(newSteps);
    };

    const updateStep = (index: number, field: keyof WorkflowStep, value: any) => {
        const newSteps = [...steps];
        newSteps[index] = { ...newSteps[index], [field]: value };
        setSteps(newSteps);
    };

    const handleSave = async () => {
        if (!name.trim()) {
            toast.error('El nombre es requerido');
            return;
        }

        if (steps.length === 0) {
            toast.error('Debe agregar al menos un paso de aprobación');
            return;
        }

        setSaving(true);
        try {
            let workflowId = id;

            // 1. Upsert Template
            if (isEditing) {
                const { error } = await supabase
                    .from('workflow_templates')
                    .update({ name, description, updated_at: new Date().toISOString() })
                    .eq('id', id);
                if (error) throw error;
            } else {
                const { data, error } = await supabase
                    .from('workflow_templates')
                    .insert({ name, description })
                    .select()
                    .single();
                if (error) throw error;
                workflowId = data.id;
            }

            // 2. Sync Steps (Delete all and re-insert for simplicity)
            if (isEditing) {
                await supabase.from('workflow_steps').delete().eq('workflow_id', workflowId);
            }

            const stepsToInsert = steps.map((s, index) => ({
                workflow_id: workflowId,
                step_order: index + 1,
                role_name: s.role_name,
                label: s.label,
            }));

            const { error: stepsError } = await supabase
                .from('workflow_steps')
                .insert(stepsToInsert);

            if (stepsError) throw stepsError;

            toast.success('Flujo guardado correctamente');
            navigate('/admin/workflows');
        } catch (error) {
            console.error('Error saving workflow:', error);
            toast.error('Error al guardar el flujo');
        } finally {
            setSaving(false);
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
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => navigate('/admin/workflows')}>
                    <ArrowLeft className="w-4 h-4" />
                </Button>
                <h1 className="text-2xl font-bold">{isEditing ? 'Editar Flujo' : 'Nuevo Flujo'}</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Información General</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Nombre del Flujo *</Label>
                                <Input
                                    id="name"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Ej: Aprobación Estándar"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="description">Descripción</Label>
                                <Textarea
                                    id="description"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                    placeholder="Descripción opcional..."
                                    rows={3}
                                />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between">
                            <CardTitle>Pasos de Aprobación</CardTitle>
                            <Button size="sm" onClick={addStep} variant="outline">
                                <Plus className="w-4 h-4 mr-2" /> Agregar Paso
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {steps.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">
                                    No hay pasos definidos. Agregue uno para comenzar.
                                </p>
                            ) : (
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead className="w-[50px]">Ord.</TableHead>
                                            <TableHead>Etiqueta del Paso</TableHead>
                                            <TableHead>Rol Aprobador</TableHead>
                                            <TableHead className="w-[50px]"></TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {steps.map((step, index) => (
                                            <TableRow key={index}>
                                                <TableCell className="font-medium">
                                                    <div className="flex items-center gap-2">
                                                        <GripVertical className="w-4 h-4 text-muted-foreground cursor-grab" />
                                                        {index + 1}
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <Input
                                                        value={step.label}
                                                        onChange={(e) => updateStep(index, 'label', e.target.value)}
                                                        placeholder="Ej: Revisión Gerencial"
                                                    />
                                                </TableCell>
                                                <TableCell>
                                                    <Select
                                                        value={step.role_name}
                                                        onValueChange={(val) => updateStep(index, 'role_name', val)}
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {APPROVAL_ROLES.map((role) => (
                                                                <SelectItem key={role} value={role}>
                                                                    {role.charAt(0).toUpperCase() + role.slice(1).replace('_', ' ')}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </TableCell>
                                                <TableCell>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        className="text-destructive hover:text-destructive"
                                                        onClick={() => removeStep(index)}
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="md:col-span-1">
                    <Card className="sticky top-6">
                        <CardHeader>
                            <CardTitle>Resumen</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-sm text-muted-foreground">
                                Este flujo tendrá <strong>{steps.length}</strong> niveles de aprobación.
                            </p>
                            <div className="bg-muted p-3 rounded-md text-xs space-y-1">
                                {steps.map((s, i) => (
                                    <div key={i} className="flex gap-2">
                                        <span className="font-bold text-muted-foreground">{i + 1}.</span>
                                        <span>{s.label} ({s.role_name})</span>
                                    </div>
                                ))}
                            </div>
                            <Button className="w-full" onClick={handleSave} disabled={saving}>
                                {saving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                                Guardar Flujo
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
