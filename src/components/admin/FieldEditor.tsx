import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FieldType, FieldRule, FieldValidation, TableColumnSchema } from '@/types/database';
import { Trash2, GripVertical, ChevronDown, ChevronUp, Plus, Copy } from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { RuleBuilder } from './RuleBuilder';
import { ValidationEditor } from './ValidationEditor';
import { normalizeRules } from '@/lib/rules';
import { parseValidation } from '@/lib/validations';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FIELD_TYPES: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Selección' },
  { value: 'boolean', label: 'Sí/No' },
  { value: 'table', label: 'Tabla' },
];

const TABLE_COLUMN_TYPES: { value: TableColumnSchema['type']; label: string }[] = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'Número' },
  { value: 'date', label: 'Fecha' },
  { value: 'select', label: 'Selección' },
  { value: 'boolean', label: 'Sí/No' },
];

export interface SectionDraft {
  id?: string;
  name: string;
  description: string;
  section_order: number;
  is_collapsible: boolean;
}

export interface FieldDraft {
  id?: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  placeholder: string;
  options_json: string[];
  table_schema_json: TableColumnSchema[];
  dependency_json: FieldRule[] | null;
  validation_json: FieldValidation | null;
  field_order: number;
  section_id: string | null;
}

interface FieldEditorProps {
  field: FieldDraft;
  index: number;
  allFields: FieldDraft[];
  sections: SectionDraft[];
  onUpdate: (index: number, updates: Partial<FieldDraft>) => void;
  onRemove: (index: number) => void;
  onClone: (index: number) => void;
  dragHandleProps?: Record<string, any>;
}

// Sortable table column row
function SortableColumnRow({ col, colIdx, field, index, onUpdate }: {
  col: TableColumnSchema;
  colIdx: number;
  field: FieldDraft;
  index: number;
  onUpdate: (index: number, updates: Partial<FieldDraft>) => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: col.key });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="grid grid-cols-[auto_1fr_1fr_auto_auto_auto] gap-2 items-end">
      <div className="flex items-center pt-5 cursor-grab text-muted-foreground" {...attributes} {...listeners}>
        <GripVertical className="w-3 h-3" />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Etiqueta</Label>
        <Input
          value={col.label}
          onChange={(e) => {
            const cols = [...(field.table_schema_json || [])];
            cols[colIdx] = { ...col, label: e.target.value, key: e.target.value.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '') || col.key };
            onUpdate(index, { table_schema_json: cols });
          }}
          placeholder="Nombre columna"
          className="h-8 text-xs"
        />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tipo</Label>
        <Select
          value={col.type}
          onValueChange={(val: TableColumnSchema['type']) => {
            const cols = [...(field.table_schema_json || [])];
            cols[colIdx] = { ...col, type: val };
            onUpdate(index, { table_schema_json: cols });
          }}
        >
          <SelectTrigger className="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TABLE_COLUMN_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {col.type === 'select' ? (
        <div className="space-y-1">
          <Label className="text-xs">Opciones</Label>
          <Input
            value={(col.options || []).join(', ')}
            onChange={(e) => {
              const cols = [...(field.table_schema_json || [])];
              cols[colIdx] = { ...col, options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) };
              onUpdate(index, { table_schema_json: cols });
            }}
            placeholder="Op1, Op2, Op3"
            className="h-8 text-xs"
          />
        </div>
      ) : <div />}
      <div className="flex items-center gap-2 pb-1">
        <Switch
          checked={col.required || false}
          onCheckedChange={(checked) => {
            const cols = [...(field.table_schema_json || [])];
            cols[colIdx] = { ...col, required: checked };
            onUpdate(index, { table_schema_json: cols });
          }}
        />
        <Label className="text-xs">Req.</Label>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 text-destructive hover:text-destructive"
        onClick={() => {
          const cols = (field.table_schema_json || []).filter((_, i) => i !== colIdx);
          onUpdate(index, { table_schema_json: cols });
        }}
      >
        <Trash2 className="w-3 h-3" />
      </Button>
      {col.type !== 'boolean' && col.type !== 'select' && (
        <div className="col-span-6 pl-6 border-l-2 border-muted">
          <ValidationEditor
            fieldType={col.type}
            validation={parseValidation(col.validation)}
            onChange={(v) => {
              const cols = [...(field.table_schema_json || [])];
              cols[colIdx] = { ...col, validation: v || undefined };
              onUpdate(index, { table_schema_json: cols });
            }}
          />
        </div>
      )}
    </div>
  );
}

// Table columns editor with DnD
function TableColumnsEditor({ field, index, onUpdate }: { field: FieldDraft; index: number; onUpdate: (index: number, updates: Partial<FieldDraft>) => void }) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );
  const cols = field.table_schema_json || [];
  const colIds = cols.map(c => c.key);

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = cols.findIndex(c => c.key === active.id);
    const newIndex = cols.findIndex(c => c.key === over.id);
    if (oldIndex !== -1 && newIndex !== -1) {
      onUpdate(index, { table_schema_json: arrayMove([...cols], oldIndex, newIndex) });
    }
  };

  return (
    <div className="space-y-3 p-3 rounded-md border bg-background">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-medium">Columnas de la tabla</Label>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={() => {
            const newCol: TableColumnSchema = {
              key: `col_${Date.now()}`,
              label: '',
              type: 'text',
            };
            onUpdate(index, { table_schema_json: [...cols, newCol] });
          }}
        >
          <Plus className="w-3 h-3 mr-1" /> Agregar columna
        </Button>
      </div>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={colIds} strategy={verticalListSortingStrategy}>
          {cols.map((col, colIdx) => (
            <SortableColumnRow key={col.key} col={col} colIdx={colIdx} field={field} index={index} onUpdate={onUpdate} />
          ))}
        </SortableContext>
      </DndContext>
      {cols.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Agregue columnas para definir la estructura de la tabla
        </p>
      )}
    </div>
  );
}

export function FieldEditor({ field, index, allFields, sections, onUpdate, onRemove, onClone, dragHandleProps }: FieldEditorProps) {
  const rules = normalizeRules(field.dependency_json);
  const [showRules, setShowRules] = useState(rules.length > 0);

  const availableFieldsForDependency = allFields.filter((f, i) => i < index && f.label);

  return (
    <div className="flex gap-3 p-4 rounded-lg border bg-muted/30">
      <div className="flex items-start pt-2 text-muted-foreground cursor-grab" {...(dragHandleProps || {})}>
        <GripVertical className="w-4 h-4" />
      </div>
      
      <div className="flex-1 space-y-3">
        {/* Main field settings */}
        <div className="grid grid-cols-4 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">Etiqueta *</Label>
            <Input
              value={field.label}
              onChange={(e) => onUpdate(index, { label: e.target.value })}
              placeholder="Nombre del campo"
              className="h-9"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Tipo</Label>
            <Select
              value={field.field_type}
              onValueChange={(value: FieldType) => onUpdate(index, { field_type: value })}
            >
              <SelectTrigger className="h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FIELD_TYPES.map((type) => (
                  <SelectItem key={type.value} value={type.value}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Placeholder</Label>
            <Input
              value={field.placeholder}
              onChange={(e) => onUpdate(index, { placeholder: e.target.value })}
              placeholder="Texto de ayuda"
              className="h-9"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2">
              <Switch
                checked={field.is_required}
                onCheckedChange={(checked) => onUpdate(index, { is_required: checked })}
              />
              <Label className="text-xs">Requerido</Label>
            </div>
          </div>
        </div>

        {/* Options for select type */}
        {field.field_type === 'select' && (
          <div className="space-y-1">
            <Label className="text-xs">Opciones por defecto (separadas por coma)</Label>
            <Input
              value={field.options_json.join(', ')}
              onChange={(e) =>
                onUpdate(index, {
                  options_json: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                })
              }
              placeholder="Opción 1, Opción 2, Opción 3"
              className="h-9"
            />
          </div>
        )}

        {/* Table column schema editor with drag-and-drop */}
        {field.field_type === 'table' && (
          <TableColumnsEditor field={field} index={index} onUpdate={onUpdate} />
        )}

        {/* Validation config */}
        {field.field_type !== 'table' && field.field_type !== 'boolean' && field.field_type !== 'select' && (
          <div className="space-y-1">
            <Label className="text-xs font-medium">Validación</Label>
            <ValidationEditor
              fieldType={field.field_type}
              validation={parseValidation(field.validation_json)}
              onChange={(v) => onUpdate(index, { validation_json: v })}
            />
          </div>
        )}

        {/* Rules configuration */}
        {availableFieldsForDependency.length > 0 && (
          <Collapsible open={showRules} onOpenChange={setShowRules}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-xs">
                {showRules ? (
                  <ChevronUp className="w-3 h-3 mr-1" />
                ) : (
                  <ChevronDown className="w-3 h-3 mr-1" />
                )}
                {rules.length > 0 ? `Reglas (${rules.length})` : 'Agregar reglas'}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <RuleBuilder
                rules={rules}
                onChange={(newRules) => onUpdate(index, { dependency_json: newRules.length > 0 ? newRules : null })}
                availableFields={availableFieldsForDependency}
                currentFieldType={field.field_type}
                tableColumns={field.table_schema_json}
              />
            </CollapsibleContent>
          </Collapsible>
        )}
      </div>

      <div className="flex flex-col gap-1 shrink-0">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onClone(index)}
          className="text-muted-foreground hover:text-foreground"
          title="Clonar campo"
        >
          <Copy className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onRemove(index)}
          className="text-destructive hover:text-destructive"
          title="Eliminar campo"
        >
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
