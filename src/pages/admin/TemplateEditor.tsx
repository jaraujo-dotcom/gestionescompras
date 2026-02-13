// editado con Gemini
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { FormTemplate, FieldRule, TableColumnSchema } from '@/types/database';
import { FieldDraft, SectionDraft } from '@/components/admin/FieldEditor';
import { SortableFieldItem } from '@/components/admin/SortableFieldItem';
import { ArrowLeft, Plus, Save, Loader2, FolderPlus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { Json } from '@/integrations/supabase/types';
import { normalizeRules } from '@/lib/rules';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable';

export default function TemplateEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // 1. Definición de Estados
  const [loading, setLoading] = useState(!!id);
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [fields, setFields] = useState<FieldDraft[]>([]);
  const [sections, setSections] = useState<SectionDraft[]>([]);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const isNew = !id || id === 'new';

  // 2. CORRECCIÓN: Declaramos los Hooks de sensores AQUÍ, antes de cualquier return
  const fieldSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    if (isNew) {
      setLoading(false);
      return;
    }
    if (id) {
      fetchTemplate();
    }
  }, [id, isNew]);

  const fetchTemplate = async () => {
    try {
      const [templateRes, fieldsRes, sectionsRes] = await Promise.all([
        supabase.from('form_templates').select('*').eq('id', id).single(),
        supabase.from('form_fields').select('*').eq('template_id', id).order('field_order'),
        supabase.from('form_sections').select('*').eq('template_id', id).order('section_order'),
      ]);

      if (templateRes.error) throw templateRes.error;

      const template = templateRes.data as FormTemplate;
      setName(template.name);
      setDescription(template.description || '');
      setIsActive(template.is_active);

      const mappedSections: SectionDraft[] = (sectionsRes.data || []).map((s) => ({
        id: s.id,
        name: s.name,
        description: s.description || '',
        section_order: s.section_order,
        is_collapsible: s.is_collapsible,
      }));
      setSections(mappedSections);

      const mappedFields: FieldDraft[] = (fieldsRes.data || []).map((f) => ({
        id: f.id,
        field_key: f.field_key,
        label: f.label,
        field_type: f.field_type as FieldDraft['field_type'],
        is_required: f.is_required,
        placeholder: f.placeholder || '',
        options_json: (f.options_json as string[]) || [],
        table_schema_json: (f.table_schema_json as unknown as TableColumnSchema[]) || [],
        dependency_json: normalizeRules(f.dependency_json as unknown as FieldRule[] | null) || null,
        validation_json: (f.validation_json as unknown as FieldDraft['validation_json']) || null,
        field_order: f.field_order,
        section_id: f.section_id || null,
      }));
      setFields(mappedFields);
    } catch (error) {
      console.error('Error fetching template:', error);
      toast.error('Error al cargar la plantilla');
      navigate('/admin/templates');
    } finally {
      setLoading(false);
    }
  };

  // --- Section helpers ---
  const addSection = () => {
    const sectionKey = `section_${Date.now()}`;
    const newSection: SectionDraft = {
      name: '',
      description: '',
      section_order: sections.length,
      is_collapsible: false,
    };
    setSections([...sections, newSection]);
  };

  const updateSection = (index: number, updates: Partial<SectionDraft>) => {
    const updated = [...sections];
    updated[index] = { ...updated[index], ...updates };
    setSections(updated);
  };

  const removeSection = (index: number) => {
    const section = sections[index];
    // Unassign fields from this section
    const sectionId = section.id || `temp_${index}`;
    setFields(fields.map(f => f.section_id === sectionId ? { ...f, section_id: null } : f));
    setSections(sections.filter((_, i) => i !== index));
  };

  // --- Field helpers ---
  const addField = (sectionId: string | null = null) => {
    const newField: FieldDraft = {
      field_key: `field_${Date.now()}`,
      label: '',
      field_type: 'text',
      is_required: false,
      placeholder: '',
      options_json: [],
      table_schema_json: [],
      dependency_json: null,
      validation_json: null,
      field_order: fields.length,
      section_id: sectionId,
    };
    setFields([...fields, newField]);
  };

  const updateField = (index: number, updates: Partial<FieldDraft>) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], ...updates };
    setFields(updated);
  };

  const removeField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  const cloneField = (index: number) => {
    const source = fields[index];
    const cloned: FieldDraft = {
      ...source,
      id: undefined,
      field_key: `${source.field_key}_copy_${Date.now()}`,
      label: `${source.label} (copia)`,
      field_order: fields.length,
    };
    const updated = [...fields];
    updated.splice(index + 1, 0, cloned);
    setFields(updated);
  };

  // Get section ID for temp sections
  const getSectionId = (section: SectionDraft, index: number) => section.id || `temp_${index}`;

  // Group fields by section
  const unsectionedFields = fields.map((f, i) => ({ field: f, globalIndex: i })).filter(({ field }) => !field.section_id);
  const getFieldsForSection = (sectionId: string) =>
    fields.map((f, i) => ({ field: f, globalIndex: i })).filter(({ field }) => field.section_id === sectionId);

  const toggleSectionCollapsed = (sectionId: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const handleSave = async () => {
    if (!name.trim()) {
      toast.error('El nombre es requerido');
      return;
    }

    for (let i = 0; i < fields.length; i++) {
      if (!fields[i].label.trim()) {
        toast.error(`Campo ${i + 1}: La etiqueta es requerida`);
        return;
      }
    }

    for (let i = 0; i < sections.length; i++) {
      if (!sections[i].name.trim()) {
        toast.error(`Sección ${i + 1}: El nombre es requerido`);
        return;
      }
    }

    setSaving(true);

    try {
      let templateId: string;

      if (isNew) {
        const { data, error } = await supabase
          .from('form_templates')
          .insert({
            name,
            description: description || null,
            is_active: isActive,
            created_by: user?.id,
          })
          .select()
          .single();

        if (error) throw error;
        templateId = data.id;
      } else {
        const { error: updateError } = await supabase
          .from('form_templates')
          .update({
            name,
            description: description || null,
            is_active: isActive,
          })
          .eq('id', id);

        if (updateError) throw updateError;

        // Delete existing fields and sections
        await supabase.from('form_fields').delete().eq('template_id', id);
        await supabase.from('form_sections').delete().eq('template_id', id);
        templateId = id!;
      }

      // Insert sections and get their IDs
      const sectionIdMap: Record<string, string> = {};
      if (sections.length > 0) {
        const sectionsToInsert = sections.map((s, index) => ({
          template_id: templateId,
          name: s.name,
          description: s.description || null,
          section_order: index,
          is_collapsible: s.is_collapsible,
        }));

        const { data: insertedSections, error: sectionsError } = await supabase
          .from('form_sections')
          .insert(sectionsToInsert)
          .select();

        if (sectionsError) throw sectionsError;

        // Map temp IDs to real IDs
        (insertedSections || []).forEach((s, idx) => {
          const tempId = getSectionId(sections[idx], idx);
          sectionIdMap[tempId] = s.id;
        });
      }

      // Insert fields
      if (fields.length > 0) {
        const fieldsToInsert = fields.map((f, index) => ({
          template_id: templateId,
          field_key: f.field_key,
          label: f.label,
          field_type: f.field_type,
          is_required: f.is_required,
          placeholder: f.placeholder || null,
          options_json: f.field_type === 'select' ? f.options_json : null,
          table_schema_json: f.field_type === 'table' && f.table_schema_json.length > 0 ? (f.table_schema_json as unknown as Json) : null,
          dependency_json: f.dependency_json ? (f.dependency_json as unknown as Json) : null,
          validation_json: f.validation_json ? (f.validation_json as unknown as Json) : null,
          field_order: index,
          section_id: f.section_id ? (sectionIdMap[f.section_id] || f.section_id) : null,
        }));

        const { error: fieldsError } = await supabase.from('form_fields').insert(fieldsToInsert);
        if (fieldsError) throw fieldsError;
      }

      toast.success(isNew ? 'Plantilla creada' : 'Plantilla actualizada');
      navigate('/admin/templates');
    } catch (error) {
      console.error('Error saving template:', error);
      toast.error('Error al guardar la plantilla');
    } finally {
      setSaving(false);
    }
  };

  const handleFieldDragEnd = (event: DragEndEvent, sectionId: string | null) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    // Find the entries for this section
    const entries = sectionId
      ? getFieldsForSection(sectionId)
      : unsectionedFields;

    const oldLocalIndex = entries.findIndex(e => e.field.field_key === active.id);
    const newLocalIndex = entries.findIndex(e => e.field.field_key === over.id);
    if (oldLocalIndex === -1 || newLocalIndex === -1) return;

    const oldGlobal = entries[oldLocalIndex].globalIndex;
    const newGlobal = entries[newLocalIndex].globalIndex;

    const updated = [...fields];
    const [moved] = updated.splice(oldGlobal, 1);
    updated.splice(newGlobal, 0, moved);
    setFields(updated);
  };

  const renderFieldList = (fieldEntries: { field: FieldDraft; globalIndex: number }[], sectionId: string | null) => {
    if (fieldEntries.length === 0) {
      return (
        <div className="text-center py-4 text-muted-foreground border border-dashed rounded-md">
          <p className="text-sm">Sin campos</p>
          <Button variant="link" size="sm" onClick={() => addField(sectionId)}>
            Agregar campo
          </Button>
        </div>
      );
    }
    const ids = fieldEntries.map(e => e.field.field_key);
    return (
      <DndContext sensors={fieldSensors} collisionDetection={closestCenter} onDragEnd={(e) => handleFieldDragEnd(e, sectionId)}>
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {fieldEntries.map(({ field, globalIndex }) => (
              <SortableFieldItem
                key={field.field_key}
                id={field.field_key}
                field={field}
                index={globalIndex}
                allFields={fields}
                sections={sections}
                onUpdate={updateField}
                onRemove={removeField}
                onClone={cloneField}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    );
  };

  // 3. El IF de carga ahora está DESPUÉS de todos los hooks
  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // ... (el resto del return es igual)

  return (
    <div className="p-6 space-y-6 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/admin/templates')}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold">
            {isNew ? 'Nueva Plantilla' : 'Editar Plantilla'}
          </h1>
          <p className="text-muted-foreground">Configure los campos del formulario</p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Información General</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nombre *</Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Solicitud de Compras"
              />
            </div>
            <div className="flex items-center gap-4 pt-6">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Plantilla activa</Label>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descripción</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe el propósito de esta plantilla..."
              rows={2}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Campos del Formulario</CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={addSection}>
              <FolderPlus className="w-4 h-4 mr-2" />
              Agregar Sección
            </Button>
            <Button variant="outline" size="sm" onClick={() => addField(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Agregar Campo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Unsectioned fields */}
          {unsectionedFields.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-muted-foreground">Campos sin sección</h3>
              </div>
              {renderFieldList(unsectionedFields, null)}
            </div>
          )}

          {/* Sections */}
          {sections.map((section, sectionIndex) => {
            const sectionId = getSectionId(section, sectionIndex);
            const sectionFields = getFieldsForSection(sectionId);
            const isCollapsed = collapsedSections[sectionId];

            return (
              <div key={sectionId} className="border rounded-lg">
                <div className="flex items-center gap-3 p-3 bg-muted/50">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => toggleSectionCollapsed(sectionId)}
                  >
                    {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
                  </Button>
                  <div className="flex-1 grid grid-cols-3 gap-2">
                    <div className="space-y-1">
                      <Label className="text-xs">Nombre de sección *</Label>
                      <Input
                        value={section.name}
                        onChange={(e) => updateSection(sectionIndex, { name: e.target.value })}
                        placeholder="Nombre de la sección"
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Descripción</Label>
                      <Input
                        value={section.description}
                        onChange={(e) => updateSection(sectionIndex, { description: e.target.value })}
                        placeholder="Descripción opcional"
                        className="h-8"
                      />
                    </div>
                    <div className="flex items-end gap-3">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={section.is_collapsible}
                          onCheckedChange={(checked) => updateSection(sectionIndex, { is_collapsible: checked })}
                        />
                        <Label className="text-xs">Colapsable</Label>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => addField(sectionId)}
                      title="Agregar campo a esta sección"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-destructive hover:text-destructive"
                      onClick={() => removeSection(sectionIndex)}
                      title="Eliminar sección"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                {!isCollapsed && (
                  <div className="p-3">
                    {renderFieldList(sectionFields, sectionId)}
                  </div>
                )}
              </div>
            );
          })}

          {fields.length === 0 && sections.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <p>No hay campos ni secciones definidos</p>
              <div className="flex justify-center gap-2 mt-2">
                <Button variant="link" onClick={addSection}>
                  Agregar sección
                </Button>
                <Button variant="link" onClick={() => addField(null)}>
                  Agregar campo
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => navigate('/admin/templates')} disabled={saving}>
          Cancelar
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          {isNew ? 'Crear Plantilla' : 'Guardar Cambios'}
        </Button>
      </div>
    </div>
  );
}
