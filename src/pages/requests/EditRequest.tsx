import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DynamicForm, validateDynamicForm } from '@/components/forms/DynamicForm';
import { Request, FormField, FormSection, FieldDependency, TableColumnSchema } from '@/types/database';
import { ArrowLeft, Save, Send, Loader2, Download, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { sendNotification } from '@/lib/notifications';
import { downloadFormTemplate, parseExcelFormData } from '@/lib/excelFormTemplate';

export default function EditRequest() {
  const { id } = useParams<{ id: string }>();
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [request, setRequest] = useState<Request | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [title, setTitle] = useState('');
  const [formValues, setFormValues] = useState<Record<string, unknown>>({});
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (id) fetchRequestData();
  }, [id]);

  const fetchRequestData = async () => {
    try {
      const { data: requestData, error: requestError } = await supabase
        .from('requests')
        .select('*')
        .eq('id', id)
        .single();

      if (requestError) throw requestError;

      const req = requestData as Request;
      setRequest(req);
      setTitle(req.title);
      setFormValues(req.data_json as Record<string, unknown> || {});

      // Fetch fields and sections if template exists
      if (req.template_id) {
        const [fieldsRes, sectionsRes] = await Promise.all([
          supabase.from('form_fields').select('*').eq('template_id', req.template_id).order('field_order'),
          supabase.from('form_sections').select('*').eq('template_id', req.template_id).order('section_order'),
        ]);

        if (fieldsRes.data) {
          const parsedFields: FormField[] = fieldsRes.data.map((f) => ({
            ...f,
            field_type: f.field_type as FormField['field_type'],
            options_json: f.options_json as string[] | null,
            table_schema_json: f.table_schema_json as unknown as TableColumnSchema[] | null,
            dependency_json: f.dependency_json as unknown as FieldDependency | null,
            section_id: f.section_id || null,
          }));
          setFields(parsedFields);
        }
        setSections((sectionsRes.data || []) as FormSection[]);
      }
    } catch (error) {
      console.error('Error fetching request:', error);
      toast.error('Error al cargar la solicitud');
      navigate('/requests');
    } finally {
      setLoading(false);
    }
  };

  const validateRequest = (submit: boolean) => {
    if (!title.trim()) {
      toast.error('El título es requerido');
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
    if (!validateRequest(submit) || !request || !user) return;

    setSaving(true);

    try {
      // Check if template has a workflow
      let hasWorkflow = false;
      if (request.template_id) {
        const { data: tplData } = await supabase
          .from('form_templates')
          .select('default_workflow_id')
          .eq('id', request.template_id)
          .single();
        hasWorkflow = !!tplData?.default_workflow_id;
      }

      const newStatus = submit
        ? (hasWorkflow ? 'en_revision' : 'aprobada')
        : request.status;

      await supabase
        .from('requests')
        .update({
          title,
          status: newStatus,
          data_json: formValues as unknown as Record<string, never>,
        })
        .eq('id', request.id);

      // Add history if submitting
      if (submit && request.status !== newStatus) {
        await supabase.from('request_status_history').insert({
          request_id: request.id,
          from_status: request.status,
          to_status: newStatus,
          changed_by: user.id,
          comment: hasWorkflow
            ? (request.status === 'devuelta' ? 'Solicitud corregida y reenviada a revisión' : 'Solicitud enviada a revisión')
            : 'Solicitud aprobada automáticamente (sin flujo de aprobación)',
        });

        const statusLabel = hasWorkflow ? 'En Revisión' : 'Aprobada';
        sendNotification({
          requestId: request.id,
          eventType: 'status_change',
          title: `Solicitud #${String(request.request_number).padStart(6, '0')}: ${statusLabel}`,
          message: `${profile?.name || 'Usuario'} envió "${title}" ${hasWorkflow ? 'a revisión' : 'directamente a ejecución (sin flujo de aprobación)'}.`,
          triggeredBy: user.id,
          newStatus: newStatus,
        });
      }

      toast.success(submit ? (hasWorkflow ? 'Solicitud enviada a revisión' : 'Solicitud lista para ejecución') : 'Cambios guardados');
      navigate(`/requests/${request.id}`);
    } catch (error) {
      console.error('Error saving request:', error);
      toast.error('Error al guardar los cambios');
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

  if (!request) {
    return (
      <div className="p-6 text-center">
        <p>Solicitud no encontrada</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">Editar Solicitud</h1>
          <p className="text-muted-foreground">Modifique los datos de la solicitud</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="title">Título de la solicitud *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
        </CardContent>
      </Card>

      {fields.length > 0 && (
        <>
          <div className="flex items-center gap-2 justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => downloadFormTemplate(fields, request.title, formValues)}
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
                    const merged = { ...formValues, ...parsed };
                    setFormValues(merged);
                    const count = Object.keys(parsed).length;
                    const { valid, errors } = validateDynamicForm(fields, merged);
                    setFormErrors(errors);
                    if (!valid) {
                      const errorCount = Object.keys(errors).length;
                      const msgs = Object.values(errors).slice(0, 5);
                      toast.warning(
                        `${count} campo(s) cargado(s), pero ${errorCount} error(es):\n${msgs.join('\n')}${errorCount > 5 ? '\n...y ' + (errorCount - 5) + ' más' : ''}`,
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

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate(-1)} disabled={saving}>
          Cancelar
        </Button>
        <Button variant="secondary" onClick={() => handleSave(false)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Guardar Cambios
        </Button>
        <Button onClick={() => handleSave(true)} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Send className="w-4 h-4 mr-2" />}
          Enviar a Revisión
        </Button>
      </div>
    </div>
  );
}
