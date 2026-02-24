import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { ArrowLeft, Plus, Trash2, Save, Loader2, GripVertical, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { WorkflowTemplate, WorkflowStep } from '@/types/database';
import { Badge } from '@/components/ui/badge';

interface StepDraft {
    step_order: number;
    role_name: string;
    label: string;
}

export default function WorkflowEditor() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [steps, setSteps] = useState<StepDraft[]>([]);
    const [availableRoles, setAvailableRoles] = useState<{ key: string; label: string }[]>([]);

    const isEditing = !!id;

    useEffect(() => {
        if (id) fetchWorkflow();
        fetchAvailableRoles();
    }, [id]);

    const fetchAvailableRoles = async () => {
        const { data } = await supabase
            .from('role_definitions')
            .select('role_key, display_name')
            .eq('can_approve', true)
            .order('display_name');
        if (data && data.length > 0) {
            setAvailableRoles(data.map((r: any) => ({ key: r.role_key, label: r.display_name })));
        } else {
            setAvailableRoles([
                { key: 'gerencia', label: 'Gerencia' },
                { key: 'procesos', label: 'Procesos' },
                { key: 'integridad_datos', label: 'Integridad de Datos' },
            ]);
        }
    };

    const fetchWorkflow = async () => {
        try {
            setLoading(true);
            const { data: template, error: templateError } = await supabase
                .from('workflow_templates')
                .select('*')
                .eq('id', id)
                .single();

            if (templateError) throw templateError;

            setName(template.name);
            setDescription(template.description || '');

            const { data: stepsData, error: stepsError } = await supabase
                .from('workflow_steps')
                .select('*')
                .eq('workflow_id', id)
                .order('step_order');

            if (stepsError) throw stepsError;

            setSteps((stepsData || []).map(s => ({
                step_order: s.step_order,
                role_name: s.role_name,
                label: s.label,
            })));
        } catch (error) {
            console.error('Error fetching workflow:', error);
            toast.error('Error al cargar el flujo');
            navigate('/admin/workflows');
        } finally {
            setLoading(false);
        }
    };

    // Group steps by step_order for display
    const groupedSteps = steps.reduce<Record<number, StepDraft[]>>((acc, step) => {
        if (!acc[step.step_order]) acc[step.step_order] = [];
        acc[step.step_order].push(step);
        return acc;
    }, {});

    const sortedLevels = Object.keys(groupedSteps).map(Number).sort((a, b) => a - b);

    const addLevel = () => {
        const maxOrder = sortedLevels.length > 0 ? Math.max(...sortedLevels) : 0;
        const newOrder = maxOrder + 1;
        setSteps([...steps, {
            step_order: newOrder,
            role_name: availableRoles[0]?.key || 'gerencia',
            label: `Aprobación Nivel ${newOrder}`,
        }]);
    };

    const addParallelStep = (level: number) => {
        setSteps([...steps, {
            step_order: level,
            role_name: availableRoles[0]?.key || 'gerencia',
            label: `Aprobación Nivel ${level} (paralelo)`,
        }]);
    };

    const removeStep = (stepToRemove: StepDraft, indexInLevel: number, level: number) => {
        // Find the actual index in the flat steps array
        let count = 0;
        const removeIdx = steps.findIndex(s => {
            if (s.step_order === level) {
                if (count === indexInLevel) return true;
                count++;
            }
            return false;
        });
        if (removeIdx >= 0) {
            const newSteps = steps.filter((_, i) => i !== removeIdx);
            // Re-number levels to be sequential
            setSteps(renumberSteps(newSteps));
        }
    };

    const renumberSteps = (stepsArr: StepDraft[]): StepDraft[] => {
        const levels = [...new Set(stepsArr.map(s => s.step_order))].sort((a, b) => a - b);
        const levelMap: Record<number, number> = {};
        levels.forEach((level, idx) => { levelMap[level] = idx + 1; });
        return stepsArr.map(s => ({ ...s, step_order: levelMap[s.step_order] }));
    };

    const updateStep = (level: number, indexInLevel: number, field: 'label' | 'role_name', value: string) => {
        let count = 0;
        const flatIdx = steps.findIndex(s => {
            if (s.step_order === level) {
                if (count === indexInLevel) return true;
                count++;
            }
            return false;
        });
        if (flatIdx >= 0) {
            const newSteps = [...steps];
            newSteps[flatIdx] = { ...newSteps[flatIdx], [field]: value };
            setSteps(newSteps);
        }
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

            if (isEditing) {
                await supabase.from('workflow_steps').delete().eq('workflow_id', workflowId);
            }

            const stepsToInsert = steps.map((s) => ({
                workflow_id: workflowId,
                step_order: s.step_order,
                role_name: s.role_name,
                label: s.label,
            }));

            const { error: stepsError } = await supabase
                .from('workflow_steps')
                .insert(stepsToInsert);

            if (stepsError) throw stepsError;

            toast.success('Flujo guardado correctamente');
            navigate('/admin/workflows');
        } catch (error: any) {
            console.error('Error saving workflow:', error);
            const msg = error?.message || error?.details || JSON.stringify(error);
            toast.error(`Error al guardar el flujo: ${msg}`);
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

    const getRoleLabel = (key: string) => availableRoles.find(r => r.key === key)?.label || key;

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
                            <Button size="sm" onClick={addLevel} variant="outline">
                                <Plus className="w-4 h-4 mr-2" /> Agregar Nivel
                            </Button>
                        </CardHeader>
                        <CardContent>
                            {sortedLevels.length === 0 ? (
                                <p className="text-center text-muted-foreground py-4">
                                    No hay pasos definidos. Agregue un nivel para comenzar.
                                </p>
                            ) : (
                                <div className="space-y-4">
                                    {sortedLevels.map((level, levelIdx) => {
                                        const levelSteps = groupedSteps[level];
                                        const isParallel = levelSteps.length > 1;
                                        return (
                                            <div key={level} className="border rounded-lg p-4 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-2">
                                                        <span className="font-semibold text-sm">Nivel {levelIdx + 1}</span>
                                                        {isParallel && (
                                                            <Badge variant="secondary" className="text-xs">
                                                                <Layers className="w-3 h-3 mr-1" />
                                                                Paralelo ({levelSteps.length} aprobadores)
                                                            </Badge>
                                                        )}
                                                    </div>
                                                    <Button
                                                        size="sm"
                                                        variant="ghost"
                                                        onClick={() => addParallelStep(level)}
                                                        className="text-xs"
                                                    >
                                                        <Plus className="w-3 h-3 mr-1" /> Paralelo
                                                    </Button>
                                                </div>
                                                {levelSteps.map((step, idxInLevel) => (
                                                    <div key={idxInLevel} className="flex items-center gap-3 pl-4 border-l-2 border-muted">
                                                        <div className="flex-1">
                                                            <Input
                                                                value={step.label}
                                                                onChange={(e) => updateStep(level, idxInLevel, 'label', e.target.value)}
                                                                placeholder="Etiqueta del paso"
                                                                className="mb-1"
                                                            />
                                                        </div>
                                                        <div className="w-48">
                                                            <Select
                                                                value={step.role_name}
                                                                onValueChange={(val) => updateStep(level, idxInLevel, 'role_name', val)}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {availableRoles.map((role) => (
                                                                        <SelectItem key={role.key} value={role.key}>
                                                                            {role.label}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="text-destructive hover:text-destructive shrink-0"
                                                            onClick={() => removeStep(step, idxInLevel, level)}
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </Button>
                                                    </div>
                                                ))}
                                            </div>
                                        );
                                    })}
                                </div>
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
                                <strong>{sortedLevels.length}</strong> nivel(es) de aprobación, <strong>{steps.length}</strong> paso(s) total(es).
                            </p>
                            <div className="bg-muted p-3 rounded-md text-xs space-y-2">
                                {sortedLevels.map((level, levelIdx) => {
                                    const levelSteps = groupedSteps[level];
                                    return (
                                        <div key={level}>
                                            <div className="font-bold text-muted-foreground mb-1">Nivel {levelIdx + 1}{levelSteps.length > 1 ? ' (paralelo)' : ''}</div>
                                            {levelSteps.map((s, i) => (
                                                <div key={i} className="pl-3 flex gap-1">
                                                    <span>→ {s.label} ({getRoleLabel(s.role_name)})</span>
                                                </div>
                                            ))}
                                        </div>
                                    );
                                })}
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
