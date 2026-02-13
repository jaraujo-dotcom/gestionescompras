import { FormField, FormSection, TableColumnSchema } from '@/types/database';
import { shouldShowField } from './DynamicFormField';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface DynamicFormViewProps {
  fields: FormField[];
  sections?: FormSection[];
  values: Record<string, unknown>;
}

export function DynamicFormView({ fields, sections = [], values }: DynamicFormViewProps) {
  const sortedFields = [...fields].sort((a, b) => a.field_order - b.field_order);
  const sortedSections = [...sections].sort((a, b) => a.section_order - b.section_order);

  const renderFieldView = (field: FormField) => {
    if (!shouldShowField(field.dependency_json, values)) return null;
    const value = values[field.field_key];

    if (field.field_type === 'table') {
      return <TableFieldView key={field.id} field={field} value={value} />;
    }

    return (
      <div key={field.id} className="flex gap-2">
        <span className="font-medium text-sm min-w-[120px]">{field.label}:</span>
        <span className="text-sm text-muted-foreground">{formatValue(field, value)}</span>
      </div>
    );
  };

  if (sortedSections.length === 0) {
    return (
      <div className="space-y-3">
        {sortedFields.map(renderFieldView)}
        {sortedFields.length === 0 && (
          <p className="text-sm text-muted-foreground">Sin datos adicionales</p>
        )}
      </div>
    );
  }

  const unsectionedFields = sortedFields.filter(f => !f.section_id);

  return (
    <div className="space-y-5">
      {unsectionedFields.length > 0 && (
        <div className="space-y-3">{unsectionedFields.map(renderFieldView)}</div>
      )}

      {sortedSections.map((section) => {
        const sectionFields = sortedFields.filter(f => f.section_id === section.id);
        const visibleFields = sectionFields.filter(f => shouldShowField(f.dependency_json, values));
        if (visibleFields.length === 0) return null;

        return (
          <div key={section.id} className="space-y-2">
            <div className="border-b pb-1">
              <h4 className="font-semibold text-sm">{section.name}</h4>
              {section.description && (
                <p className="text-xs text-muted-foreground">{section.description}</p>
              )}
            </div>
            <div className="space-y-3 pl-2">
              {sectionFields.map(renderFieldView)}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function TableFieldView({ field, value }: { field: FormField; value: unknown }) {
  const columns: TableColumnSchema[] = field.table_schema_json || [];
  const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];

  if (rows.length === 0) {
    return (
      <div className="space-y-1">
        <span className="font-medium text-sm">{field.label}:</span>
        <p className="text-sm text-muted-foreground">Sin datos</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <span className="font-medium text-sm">{field.label}:</span>
      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className="text-xs whitespace-nowrap">{col.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={idx}>
                {columns.map((col) => (
                  <TableCell key={col.key} className="text-xs py-1.5">
                    {formatCellValue(col, row[col.key])}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function formatCellValue(col: TableColumnSchema, value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  switch (col.type) {
    case 'boolean': return value ? 'Sí' : 'No';
    case 'date': try { return new Date(String(value)).toLocaleDateString('es-ES'); } catch { return String(value); }
    case 'number': return Number(value).toLocaleString('es-ES');
    default: return String(value);
  }
}

function formatValue(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  switch (field.field_type) {
    case 'boolean': return value ? 'Sí' : 'No';
    case 'date': try { return new Date(String(value)).toLocaleDateString('es-ES'); } catch { return String(value); }
    case 'number': return Number(value).toLocaleString('es-ES');
    default: return String(value);
  }
}
