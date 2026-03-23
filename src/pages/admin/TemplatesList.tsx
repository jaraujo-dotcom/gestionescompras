import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FormTemplate } from '@/types/database';
import { Loader2, Settings, Plus, Edit, Trash2, Copy } from 'lucide-react';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export default function TemplatesList() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [cloning, setCloning] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from('form_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data as FormTemplate[]);
    } catch (error) {
      console.error('Error fetching templates:', error);
      toast.error('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (template: FormTemplate) => {
    try {
      await supabase
        .from('form_templates')
        .update({ is_active: !template.is_active })
        .eq('id', template.id);

      toast.success(template.is_active ? 'Plantilla desactivada' : 'Plantilla activada');
      fetchTemplates();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Error al actualizar plantilla');
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    try {
      // Check if template has associated requests
      const { count } = await supabase
        .from('requests')
        .select('id', { count: 'exact', head: true })
        .eq('template_id', deleteId);

      if (count && count > 0) {
        toast.error(`No se puede eliminar: tiene ${count} solicitud(es) asociada(s). Desactívela en su lugar.`);
        setDeleteId(null);
        return;
      }

      // Delete fields, sections, group links, then template
      await Promise.all([
        supabase.from('form_fields').delete().eq('template_id', deleteId),
        supabase.from('form_sections').delete().eq('template_id', deleteId),
        supabase.from('form_template_groups').delete().eq('template_id', deleteId),
      ]);

      const { error } = await supabase.from('form_templates').delete().eq('id', deleteId);
      if (error) throw error;

      toast.success('Plantilla eliminada');
      fetchTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('Error al eliminar la plantilla');
    } finally {
      setDeleteId(null);
    }
  };

  const handleClone = async (templateId: string) => {
    setCloning(templateId);
    try {
      // Fetch template
      const { data: tpl, error: tplErr } = await supabase
        .from('form_templates')
        .select('*')
        .eq('id', templateId)
        .single();
      if (tplErr) throw tplErr;

      // Fetch fields, sections, group links
      const [fieldsRes, sectionsRes, groupsRes] = await Promise.all([
        supabase.from('form_fields').select('*').eq('template_id', templateId).order('field_order'),
        supabase.from('form_sections').select('*').eq('template_id', templateId).order('section_order'),
        supabase.from('form_template_groups').select('group_id').eq('template_id', templateId),
      ]);

      // Create new template
      const { data: newTpl, error: newErr } = await supabase
        .from('form_templates')
        .insert({
          name: `${tpl.name} (copia)`,
          description: tpl.description,
          is_active: false,
          created_by: tpl.created_by,
          default_workflow_id: tpl.default_workflow_id,
          executor_group_id: tpl.executor_group_id,
        })
        .select()
        .single();
      if (newErr) throw newErr;

      const newTemplateId = newTpl.id;

      // Clone sections and map old IDs to new IDs
      const sectionIdMap: Record<string, string> = {};
      if (sectionsRes.data && sectionsRes.data.length > 0) {
        const sectionsToInsert = sectionsRes.data.map((s: any) => ({
          template_id: newTemplateId,
          name: s.name,
          description: s.description,
          section_order: s.section_order,
          is_collapsible: s.is_collapsible,
        }));
        const { data: newSections, error: secErr } = await supabase
          .from('form_sections')
          .insert(sectionsToInsert)
          .select();
        if (secErr) throw secErr;
        (newSections || []).forEach((ns: any, idx: number) => {
          sectionIdMap[sectionsRes.data![idx].id] = ns.id;
        });
      }

      // Clone fields
      if (fieldsRes.data && fieldsRes.data.length > 0) {
        const fieldsToInsert = fieldsRes.data.map((f: any) => ({
          template_id: newTemplateId,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: f.is_required,
          is_external: f.is_external,
          external_mode: f.external_mode,
          placeholder: f.placeholder,
          options_json: f.options_json,
          table_schema_json: f.table_schema_json,
          dependency_json: f.dependency_json,
          validation_json: f.validation_json,
          field_order: f.field_order,
          section_id: f.section_id ? (sectionIdMap[f.section_id] || null) : null,
        }));
        const { error: fErr } = await supabase.from('form_fields').insert(fieldsToInsert);
        if (fErr) throw fErr;
      }

      // Clone group links
      if (groupsRes.data && groupsRes.data.length > 0) {
        const groupLinks = groupsRes.data.map((g: any) => ({
          template_id: newTemplateId,
          group_id: g.group_id,
        }));
        const { error: gErr } = await supabase.from('form_template_groups').insert(groupLinks);
        if (gErr) throw gErr;
      }

      toast.success('Plantilla clonada exitosamente');
      fetchTemplates();
    } catch (error) {
      console.error('Error cloning template:', error);
      toast.error('Error al clonar la plantilla');
    } finally {
      setCloning(null);
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
          <h1 className="text-2xl font-bold">Plantillas de Formulario</h1>
          <p className="text-muted-foreground">Administre las plantillas de solicitud</p>
        </div>
        <Link to="/admin/templates/new">
          <Button>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Plantilla
          </Button>
        </Link>
      </div>

      {templates.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="w-12 h-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">Sin plantillas</h3>
            <p className="text-muted-foreground mb-4">Cree su primera plantilla de formulario</p>
            <Link to="/admin/templates/new">
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Crear Plantilla
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {templates.map((template) => (
            <Card key={template.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold">{template.name}</h3>
                      <span
                        className={`text-xs px-2 py-0.5 rounded ${
                          template.is_active
                            ? 'bg-emerald-100 text-emerald-700'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {template.is_active ? 'Activa' : 'Inactiva'}
                      </span>
                    </div>
                    {template.description && (
                      <p className="text-sm text-muted-foreground">{template.description}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-1">
                      Creada: {new Date(template.created_at).toLocaleDateString('es-ES')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Activa</span>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => toggleActive(template)}
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleClone(template.id)}
                      disabled={cloning === template.id}
                    >
                      {cloning === template.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Copy className="w-4 h-4 mr-1" />
                      )}
                      Clonar
                    </Button>
                    <Link to={`/admin/templates/${template.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-1" />
                        Editar
                      </Button>
                    </Link>
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setDeleteId(template.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => { if (!o) setDeleteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminarán todos los campos y secciones asociados.
              Si la plantilla tiene solicitudes asociadas, no podrá ser eliminada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
