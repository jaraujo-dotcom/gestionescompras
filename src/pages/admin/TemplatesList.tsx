import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { FormTemplate } from '@/types/database';
import { Loader2, Settings, Plus, Edit } from 'lucide-react';
import { toast } from 'sonner';

export default function TemplatesList() {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [loading, setLoading] = useState(true);

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
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">Activa</span>
                      <Switch
                        checked={template.is_active}
                        onCheckedChange={() => toggleActive(template)}
                      />
                    </div>
                    <Link to={`/admin/templates/${template.id}`}>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-2" />
                        Editar
                      </Button>
                    </Link>
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
