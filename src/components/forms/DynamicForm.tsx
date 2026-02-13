import { useState } from 'react';
import { FormField, FormSection } from '@/types/database';
import { DynamicFormField, shouldShowField, isFieldRequired } from './DynamicFormField';
import { parseValidation, validateFieldValue, validateCellValue } from '@/lib/validations';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface DynamicFormProps {
  fields: FormField[];
  sections?: FormSection[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
  readOnly?: boolean;
}

export function DynamicForm({ fields, sections = [], values, onChange, readOnly = false }: DynamicFormProps) {
  const sortedFields = [...fields].sort((a, b) => a.field_order - b.field_order);
  const sortedSections = [...sections].sort((a, b) => a.section_order - b.section_order);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});

  const handleFieldChange = (key: string, value: unknown) => {
    onChange({ ...values, [key]: value });
  };

  const toggleSection = (sectionId: string) => {
    setCollapsedSections(prev => ({ ...prev, [sectionId]: !prev[sectionId] }));
  };

  const renderFields = (fieldList: FormField[]) =>
    fieldList.map((field) => (
      <DynamicFormField
        key={field.id}
        field={field}
        value={values[field.field_key]}
        onChange={handleFieldChange}
        allValues={values}
        readOnly={readOnly}
      />
    ));

  // If no sections, render flat
  if (sortedSections.length === 0) {
    return <div className="space-y-4">{renderFields(sortedFields)}</div>;
  }

  const unsectionedFields = sortedFields.filter(f => !f.section_id);

  return (
    <div className="space-y-6">
      {unsectionedFields.length > 0 && (
        <div className="space-y-4">{renderFields(unsectionedFields)}</div>
      )}

      {sortedSections.map((section) => {
        const sectionFields = sortedFields.filter(f => f.section_id === section.id);
        if (sectionFields.length === 0) return null;

        // Check if all fields in this section are hidden
        const hasVisibleFields = sectionFields.some(f => shouldShowField(f.dependency_json, values));
        if (!hasVisibleFields) return null;

        const isCollapsed = collapsedSections[section.id];

        if (section.is_collapsible) {
          return (
            <div key={section.id} className="border rounded-lg">
              <button
                type="button"
                className="flex items-center justify-between w-full p-4 text-left hover:bg-muted/50 transition-colors"
                onClick={() => toggleSection(section.id)}
              >
                <div>
                  <h3 className="font-semibold text-sm">{section.name}</h3>
                  {section.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{section.description}</p>
                  )}
                </div>
                {isCollapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
              </button>
              {!isCollapsed && (
                <div className="px-4 pb-4 space-y-4">
                  {renderFields(sectionFields)}
                </div>
              )}
            </div>
          );
        }

        return (
          <div key={section.id} className="space-y-3">
            <div className="border-b pb-1">
              <h3 className="font-semibold text-sm">{section.name}</h3>
              {section.description && (
                <p className="text-xs text-muted-foreground">{section.description}</p>
              )}
            </div>
            <div className="space-y-4">
              {renderFields(sectionFields)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Validation helper
export function validateDynamicForm(
  fields: FormField[],
  values: Record<string, unknown>
): { valid: boolean; errors: Record<string, string> } {
  const errors: Record<string, string> = {};

  for (const field of fields) {
    if (!shouldShowField(field.dependency_json, values)) continue;

    const isRequired = isFieldRequired(field, values);
    const value = values[field.field_key];

    if (isRequired) {
      if (field.field_type === 'table') {
        const rows = Array.isArray(value) ? value : [];
        if (rows.length === 0) {
          errors[field.field_key] = `${field.label} requiere al menos una fila`;
        }
      } else if (value === undefined || value === null || value === '') {
        errors[field.field_key] = `${field.label} es requerido`;
      }
    }

    if (value !== undefined && value !== null && value !== '') {
      if (field.field_type === 'number' && isNaN(Number(value))) {
        errors[field.field_key] = `${field.label} debe ser un número válido`;
      }

      const validation = parseValidation(field.validation_json);
      if (validation && field.field_type !== 'table') {
        const validationError = validateFieldValue(value, field.field_type, validation);
        if (validationError) {
          errors[field.field_key] = `${field.label}: ${validationError}`;
        }
      }

      if (field.field_type === 'table' && Array.isArray(value)) {
        const columns = field.table_schema_json || [];
        const rows = value as Record<string, unknown>[];
        for (let rowIdx = 0; rowIdx < rows.length; rowIdx++) {
          for (const col of columns) {
            if (col.validation) {
              const cellVal = rows[rowIdx][col.key];
              if (cellVal !== undefined && cellVal !== null && cellVal !== '') {
                const cellError = validateCellValue(cellVal, col.type, parseValidation(col.validation));
                if (cellError) {
                  errors[field.field_key] = errors[field.field_key] ||
                    `${field.label}, fila ${rowIdx + 1}, ${col.label}: ${cellError}`;
                }
              }
            }
          }
        }
      }
    }
  }

  return { valid: Object.keys(errors).length === 0, errors };
}
