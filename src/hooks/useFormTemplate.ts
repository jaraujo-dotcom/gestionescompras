import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { FormTemplate, FormField, FormSection, FieldDependency, TableColumnSchema } from '@/types/database';

interface UseFormTemplateOptions {
  /** When provided, only templates linked to at least one of these groups are returned */
  userGroupIds?: string[];
}

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

export function useFormTemplate(options?: UseFormTemplateOptions): UseFormTemplateResult {
  const [templates, setTemplates] = useState<FormTemplate[]>([]);
  const [allTemplates, setAllTemplates] = useState<FormTemplate[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<FormTemplate | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [sections, setSections] = useState<FormSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const userGroupIds = options?.userGroupIds;

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('form_templates')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (fetchError) throw fetchError;
      const all = (data || []) as FormTemplate[];
      setAllTemplates(all);
    } catch (err) {
      console.error('Error fetching templates:', err);
      setError('Error al cargar plantillas');
    } finally {
      setLoading(false);
    }
  };

  // Filter templates by user groups when userGroupIds change
  useEffect(() => {
    if (!userGroupIds || userGroupIds.length === 0) {
      setTemplates(allTemplates);
      return;
    }

    const filterByGroups = async () => {
      const { data } = await supabase
        .from('form_template_groups')
        .select('template_id')
        .in('group_id', userGroupIds);

      if (data && data.length > 0) {
        const allowedIds = new Set(data.map((d: any) => d.template_id));
        setTemplates(allTemplates.filter((t) => allowedIds.has(t.id)));
      } else {
        // No links exist yet – show all templates (backward compatible)
        setTemplates(allTemplates);
      }
    };
    filterByGroups();
  }, [allTemplates, userGroupIds?.join(',')]);

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
