import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormTemplate, FormField, FormSection, FieldDependency, TableColumnSchema } from '@/types/database';

interface UseFormTemplateResult {
  templates: FormTemplate[];
  selectedTemplate: FormTemplate | null;
  fields: FormField[];
  sections: FormSection[];
  loading: boolean;
  error: string | null;
  selectTemplate: (templateId: string) => void;
  refreshTemplates: () => void;
}

export function useFormTemplate(): UseFormTemplateResult {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;
      setTemplates(data as FormTemplate[]);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  const fetchFields = async (templateId: string) => {
    try {
      const [fieldsRes, sectionsRes] = await Promise.all([
        supabase
          .from('form_fields')
          .select('*')
          .eq('template_id', templateId)
          .order('field_order'),
        supabase
          .from('form_sections')
          .select('*')
          .eq('template_id', templateId)
          .order('section_order'),
      ]);

      if (fieldsRes.error) throw fieldsRes.error;
      if (sectionsRes.error) throw sectionsRes.error;
      
      const parsedFields: FormField[] = (fieldsRes.data || []).map((f) => ({
        ...f,
        field_type: f.field_type as FormField['field_type'],
        options_json: f.options_json as string[] | null,
        table_schema_json: f.table_schema_json as unknown as TableColumnSchema[] | null,
        dependency_json: f.dependency_json as unknown as FieldDependency | null,
        section_id: f.section_id || null,
      }));
      
      setFields(parsedFields);
      setSections((sectionsRes.data || []) as FormSection[]);
    } catch (err) {
      console.error('Error fetching fields:', err);
      setError('Error al cargar campos');
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  const selectTemplate = (templateId: string) => {
    const template = templates.find((t) => t.id === templateId);
    setSelectedTemplate(template || null);
    if (template) {
      fetchFields(templateId);
    } else {
      setFields([]);
      setSections([]);
    }
  };

  return {
    templates,
    selectedTemplate,
    fields,
    sections,
    loading,
    error,
    selectTemplate,
    refreshTemplates: fetchTemplates,
  };
}
