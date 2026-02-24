import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useFormTemplate } from '@/hooks/useFormTemplate';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DynamicForm, validateDynamicForm } from '@/components/forms/DynamicForm';
import { ArrowLeft, Save, Send, Loader2, Settings, FileText, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { sendNotification } from '@/lib/notifications';
import { downloadFormTemplate, parseExcelFormData } from '@/lib/excelFormTemplate';

export default function NewRequest() {
  const { user, hasRole, profile } = useAuth();
  const navigate = useNavigate();
  const { templates, selectedTemplate, fields, sections, loading: templatesLoading, selectTemplate } = useFormTemplate();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [userGroups, setUserGroups] = useState<{ id: string; name: string }[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  // Fetch user groups
  useEffect(() => {
    const fetchGroups = async () => {
      if (!user) return;
      const { data } = await supabase
        .from('user_groups')
        .select('group_id, groups(id, name)')
        .eq('user_id', user.id);
      if (data) {
        const groups = data
          .map((d: any) => d.groups)
          .filter(Boolean);
        setUserGroups(groups);
        if (groups.length === 1) setSelectedGroupId(groups[0].id);
      }
    };
    fetchGroups();
  }, [user]);

  const validateRequest = (submit: boolean) => {
    if (!title.trim()) {
      toast.error('El título es requerido');
      return false;
    }

    if (!selectedTemplate) {
      toast.error('Debe seleccionar un tipo de solicitud');
      return false;
    }

    if (!selectedGroupId || selectedGroupId === '__none__') {
      toast.error('Debe seleccionar un grupo para la solicitud');
      return false;
    }

    // Always validate form fields (both save and submit)
    if (fields.length > 0) {
      const { valid, errors } = validateDynamicForm(fields, formValues);
      setFormErrors(errors);
      if (!valid) {
        const firstError = Object.values(errors)[0];
        toast.error(firstError);
        return false;
      }
    }

    return true;
  };

  const handleSave = async (submit: boolean = false) => {
    if (!validateRequest(submit)) return;
    if (!user || !selectedTemplate) return;

    setSaving(true);

    try {
      // If no workflow assigned, skip approval and go directly to execution
      const hasWorkflow = !!selectedTemplate.default_workflow_id;
      const status = submit
        ? (hasWorkflow ? 'en_revision' : 'aprobada')
        : 'borrador';

      const insertData: any = {
        title,
        template_id: selectedTemplate.id,
        created_by: user.id,
        status,
        data_json: formValues as unknown as Record<string, never>,
      };
      if (selectedGroupId && selectedGroupId !== '__none__') {
        insertData.group_id = selectedGroupId;
      }

      const { error: requestError } = await supabase
        .from('requests')
        .insert([insertData]);

      if (requestError) throw requestError;

      // Fetch the newly created request to get its ID
      const { data: requestData, error: fetchError } = await supabase
        .from('requests')
        .select('id, request_number')
        .eq('created_by', user.id)
        .eq('title', title)
        .eq('template_id', selectedTemplate.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (fetchError) throw fetchError;

      await supabase.from('request_status_history').insert({
        request_id: requestData.id,
        from_status: null,
        to_status: status,
        changed_by: user.id,
          comment: submit
          ? (hasWorkflow ? 'Solicitud enviada a revisión' : 'Solicitud aprobada automáticamente (sin flujo de aprobación)')
          : 'Solicitud creada como borrador',
      });

      // Workflow Instantiation (only if template has a workflow)
      if (hasWorkflow && selectedTemplate.default_workflow_id) {
        const { data: workflowSteps } = await supabase
          .from('workflow_steps')
          .select('*')
          .eq('workflow_id', selectedTemplate.default_workflow_id)
          .order('step_order');

        if (workflowSteps && workflowSteps.length > 0) {
          const requestSteps = workflowSteps.map((step: any) => ({
            request_id: requestData.id,
            step_order: step.step_order,
            role_name: step.role_name,
            label: step.label,
            status: 'pending',
          }));

          const { error: stepsError } = await supabase
            .from('request_workflow_steps')
            .insert(requestSteps);

          if (stepsError) throw stepsError;
        }
      }

      if (submit) {
        const notifStatus = hasWorkflow ? 'en_revision' : 'aprobada';
        const statusLabel = hasWorkflow ? 'En Revisión' : 'Aprobada';
        sendNotification({
          requestId: requestData.id,
          eventType: 'status_change',
          title: `Solicitud #${String(requestData.request_number).padStart(6, '0')}: ${statusLabel}`,
          message: `${profile?.name || 'Usuario'} envió "${title}" ${hasWorkflow ? 'a revisión' : 'directamente a ejecución (sin flujo de aprobación)'}.`,
          triggeredBy: user.id,
          newStatus: notifStatus,
        });
      }

      toast.success(submit ? (hasWorkflow ? 'Solicitud enviada a revisión' : 'Solicitud lista para ejecución') : 'Borrador guardado');
      navigate('/requests');
    } catch (error: any) {
      console.error('Error saving request:', error);
      const detail = error?.message || error?.details || JSON.stringify(error);
      toast.error(`Error al guardar: ${detail}`);
    } finally {
      setSaving(false);
    }
  };

  // Show empty state if no templates exist
  if (!templatesLoading && templates.length === 0) {
    return (
      <div className="p-6 space-y-6 max-w-5xl mx-auto">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate('/requests')}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <h1 className="text-2xl font-bold">Nueva Solicitud</h1>
        </div>

        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin formularios disponibles</h3>
            <p className="text-muted-foreground text-center mb-4">
              No hay plantillas de formulario configuradas.<br />
              Un administrador debe crear al menos una plantilla.
            </p>
            {hasRole('administrador') && (
              <Link to="/admin/templates/new">
                <Button>
                  <Settings className="w-4 h-4 mr-2" />
                  Crear Plantilla
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/requests')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Nueva Solicitud</h1>
          <p className="text-muted-foreground">Seleccione el tipo y complete los datos</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="template">Tipo de Solicitud *</Label>
              <Select
                value={selectedTemplate?.id || ''}
                onValueChange={selectTemplate}
                disabled={templatesLoading}
              >
                <SelectTrigger>
                  <SelectValue placeholder={templatesLoading ? 'Cargando...' : 'Seleccionar tipo...'} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((template) => (
                    <SelectItem key={template.id} value={template.id}>
                      {template.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTemplate?.description && (
                <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Título de la solicitud *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ej: Compra de suministros"
                required
              />
            </div>
          </div>
          {userGroups.length > 0 && (
            <div className="space-y-2">
              <Label>Grupo *</Label>
              <Select value={selectedGroupId} onValueChange={setSelectedGroupId}>
                <SelectTrigger className="w-[300px]">
                  <SelectValue placeholder="Sin grupo asignado" />
                </SelectTrigger>
                <SelectContent>
                  {userGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Seleccione el grupo al que pertenece esta solicitud</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedTemplate && fields.length > 0 && (
        <>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadFormTemplate(fields, selectedTemplate.name, formValues)}
            >
              <Download className="w-4 h-4 mr-1" />
              Descargar Plantilla Excel
            </Button>
            <label className="cursor-pointer">
              <Button variant="outline" size="sm" asChild>
                <span>
                  <Upload className="w-4 h-4 mr-1" />
                  Cargar desde Excel
                </span>
              </Button>
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  try {
                    const parsed = await parseExcelFormData(file, fields);
                    console.log('[Excel Import] Parsed values:', JSON.stringify(parsed));
                    console.log('[Excel Import] Fields count:', fields.length);
                    console.log('[Excel Import] Required fields:', fields.filter(f => f.is_required).map(f => `${f.field_key} (${f.label})`));
                    const merged = { ...formValues, ...parsed };
                    console.log('[Excel Import] Merged values:', JSON.stringify(merged));
                    setFormValues(merged);
                    const count = Object.keys(parsed).length;
                    const { valid, errors } = validateDynamicForm(fields, merged);
                    console.log('[Excel Import] Validation result:', { valid, errors });
                    setFormErrors(errors);
                    if (!valid) {
                      const errorCount = Object.keys(errors).length;
                      const msgs = Object.values(errors).slice(0, 5);
                      toast.warning(
                        `${count} campo(s) cargado(s), pero ${errorCount} error(es):\n${msgs.join('\n')}${errorCount > 5 ? `\n...y ${errorCount - 5} más` : ''}`,
                        { duration: 8000 }
                      );
                    } else {
                      toast.success(`${count} campo(s) cargado(s) correctamente`);
                    }
                  } catch (err) {
                    console.error('Error parsing Excel:', err);
                    toast.error('Error al leer el archivo Excel');
                  }
                  e.target.value = '';
                }}
              />
            </label>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Datos del Formulario</CardTitle>
            </CardHeader>
            <CardContent>
              <DynamicForm
                fields={fields}
                sections={sections}
                values={formValues}
                onChange={(v) => { setFormValues(v); setFormErrors({}); }}
                errors={formErrors}
              />
            </CardContent>
          </Card>
        </>
      )}

      {selectedTemplate && fields.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Esta plantilla no tiene campos configurados.</p>
            {hasRole('administrador') && (
              <Link to={`/admin/templates/${selectedTemplate.id}`} className="text-primary hover:underline text-sm">
                Configurar campos
              </Link>
            )}
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/requests')} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving || !selectedTemplate}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Borrador
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving || !selectedTemplate}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          {selectedTemplate?.default_workflow_id ? 'Enviar a Revisión' : 'Enviar'}
        </Button>
      </div>
    </div>
  );
}
