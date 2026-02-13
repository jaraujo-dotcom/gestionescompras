import { useState } from 'react';
import { FormField, FieldRule, FieldDependency, TableColumnSchema } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CopyCheck } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import {
  normalizeRules,
  shouldShowField as shouldShowFieldFromRules,
  isFieldDynamicallyRequired,
  getFieldDynamicOptions,
  getTableColumnDynamicOptions,
} from '@/lib/rules';
import { parseValidation, validateFieldValue, validateCellValue, describeValidation } from '@/lib/validations';

interface DynamicFormFieldProps {
  field: FormField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  allValues: Record<string, unknown>;
  readOnly?: boolean;
}

// Public helpers used by DynamicForm and DynamicFormView
export function shouldShowField(
  dep: FieldRule[] | FieldDependency | null,
  allValues: Record<string, unknown>
): boolean {
  return shouldShowFieldFromRules(normalizeRules(dep), allValues);
}

export function isFieldRequired(
  field: FormField,
  allValues: Record<string, unknown>
): boolean {
  if (field.is_required) return true;
  const rules = normalizeRules(field.dependency_json);
  return isFieldDynamicallyRequired(rules, allValues);
}

function TableFieldInput({
  columns,
  rows,
  onChange,
  readOnly,
  columnOptionsOverrides,
}: {
  columns: TableColumnSchema[];
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
  readOnly: boolean;
  columnOptionsOverrides?: Record<string, string[]>;
}) {
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});

  const addRow = () => {
    const emptyRow: Record<string, unknown> = {};
    columns.forEach((col) => {
      emptyRow[col.key] = col.type === 'boolean' ? false : '';
    });
    onChange([...rows, emptyRow]);
  };

  const removeRow = (rowIdx: number) => {
    onChange(rows.filter((_, i) => i !== rowIdx));
    // Clean up errors for removed row
    const newErrors = { ...cellErrors };
    Object.keys(newErrors).forEach((k) => {
      if (k.startsWith(`${rowIdx}_`)) delete newErrors[k];
    });
    setCellErrors(newErrors);
  };

  const copyCellDown = (sourceIdx: number, colKey: string) => {
    if (sourceIdx >= rows.length - 1) return;
    const val = rows[sourceIdx][colKey];
    const updated = rows.map((row, i) =>
      i > sourceIdx ? { ...row, [colKey]: val } : row
    );
    onChange(updated);
  };

  const updateCell = (rowIdx: number, colKey: string, value: unknown) => {
    const updated = [...rows];
    updated[rowIdx] = { ...updated[rowIdx], [colKey]: value };
    onChange(updated);

    // Validate cell
    const col = columns.find((c) => c.key === colKey);
    if (col?.validation) {
      const error = validateCellValue(value, col.type, parseValidation(col.validation));
      const errorKey = `${rowIdx}_${colKey}`;
      setCellErrors((prev) => {
        if (error) return { ...prev, [errorKey]: error };
        const { [errorKey]: _, ...rest } = prev;
        return rest;
      });
    }
  };

  const renderCell = (col: TableColumnSchema, row: Record<string, unknown>, rowIdx: number) => {
    const val = row[col.key];
    const errorKey = `${rowIdx}_${col.key}`;
    const error = cellErrors[errorKey];

    const cellContent = (() => {
      switch (col.type) {
        case 'text':
          return (
            <Input
              value={String(val || '')}
              onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
              disabled={readOnly}
              className="h-8 text-xs"
            />
          );
        case 'number':
          return (
            <Input
              type="number"
              value={val !== undefined && val !== null && val !== '' ? Number(val) : ''}
              onChange={(e) => updateCell(rowIdx, col.key, e.target.value ? parseFloat(e.target.value) : null)}
              disabled={readOnly}
              className="h-8 text-xs"
            />
          );
        case 'date':
          return (
            <Input
              type="date"
              value={String(val || '')}
              onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
              disabled={readOnly}
              className="h-8 text-xs"
            />
          );
        case 'boolean':
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={Boolean(val)}
                onCheckedChange={(checked) => updateCell(rowIdx, col.key, checked)}
                disabled={readOnly}
              />
            </div>
          );
        case 'select': {
          const opts = columnOptionsOverrides?.[col.key] ?? col.options ?? [];
          return (
            <Select
              value={String(val || '')}
              onValueChange={(v) => updateCell(rowIdx, col.key, v)}
              disabled={readOnly}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="..." />
              </SelectTrigger>
              <SelectContent>
                {opts.map((opt) => (
                  <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          );
        }
        default:
          return null;
      }
    })();

    return (
      <div className="flex items-center gap-0.5">
        <div className="flex-1">
          {cellContent}
          {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
        </div>
        {!readOnly && rowIdx < rows.length - 1 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="icon" className="h-5 w-5 shrink-0 text-muted-foreground hover:text-primary" onClick={() => copyCellDown(rowIdx, col.key)}>
                <CopyCheck className="w-3 h-3" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">Copiar hacia abajo</TooltipContent>
          </Tooltip>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((col) => (
                <TableHead key={col.key} className="text-xs whitespace-nowrap">
                  {col.label}{col.required ? ' *' : ''}
                </TableHead>
              ))}
              {!readOnly && <TableHead className="w-10" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length + (readOnly ? 0 : 1)} className="text-center text-xs text-muted-foreground py-4">
                  Sin filas. {!readOnly && 'Agregue una fila para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  {columns.map((col) => (
                    <TableCell key={col.key} className="py-1 px-2">
                      {renderCell(col, row, rowIdx)}
                    </TableCell>
                  ))}
                  {!readOnly && (
                    <TableCell className="py-1 px-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(rowIdx)}>
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    </TableCell>
                  )}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      {!readOnly && (
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
          <Plus className="w-3 h-3 mr-1" /> Agregar fila
        </Button>
      )}
    </div>
  );
}

export function DynamicFormField({
  field,
  value,
  onChange,
  allValues,
  readOnly = false,
}: DynamicFormFieldProps) {
  const [fieldError, setFieldError] = useState<string | null>(null);

  if (!shouldShowField(field.dependency_json, allValues)) {
    return null;
  }

  const isRequired = isFieldRequired(field, allValues);
  const labelText = `${field.label}${isRequired ? ' *' : ''}`;

  // Get dynamic options for select fields
  const rules = normalizeRules(field.dependency_json);
  const dynamicOptions = getFieldDynamicOptions(rules, allValues);
  const selectOptions = dynamicOptions ?? (field.options_json || []);
  const validation = parseValidation(field.validation_json);
  const validationHint = describeValidation(field.field_type, validation);

  const handleChange = (key: string, newValue: unknown) => {
    onChange(key, newValue);
    // Validate on change
    if (validation && !readOnly) {
      const error = validateFieldValue(newValue, field.field_type, validation);
      setFieldError(error);
    }
  };

  const renderField = () => {
    switch (field.field_type) {
      case 'text':
        return (
          <Input
            value={String(value || '')}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
            placeholder={field.placeholder || ''}
            disabled={readOnly}
            required={isRequired}
          />
        );

      case 'number':
        return (
          <Input
            type="number"
            value={value !== undefined && value !== null ? Number(value) : ''}
            onChange={(e) => handleChange(field.field_key, e.target.value ? parseFloat(e.target.value) : null)}
            placeholder={field.placeholder || ''}
            disabled={readOnly}
            required={isRequired}
          />
        );

      case 'date':
        return (
          <Input
            type="date"
            value={String(value || '')}
            onChange={(e) => handleChange(field.field_key, e.target.value)}
            disabled={readOnly}
            required={isRequired}
          />
        );

      case 'boolean':
        return (
          <div className="flex items-center gap-2">
            <Switch
              checked={Boolean(value)}
              onCheckedChange={(checked) => handleChange(field.field_key, checked)}
              disabled={readOnly}
            />
            <span className="text-sm text-muted-foreground">
              {value ? 'Sí' : 'No'}
            </span>
          </div>
        );

      case 'select':
        return (
          <Select
            value={String(value || '')}
            onValueChange={(val) => handleChange(field.field_key, val)}
            disabled={readOnly}
          >
            <SelectTrigger>
              <SelectValue placeholder={field.placeholder || 'Seleccionar...'} />
            </SelectTrigger>
            <SelectContent>
              {selectOptions.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );

      case 'table': {
        const columns = field.table_schema_json || [];
        const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
        // Build column option overrides from rules
        const columnOptionsOverrides: Record<string, string[]> = {};
        for (const col of columns) {
          if (col.type === 'select') {
            const dynOpts = getTableColumnDynamicOptions(rules, allValues, col.key);
            if (dynOpts) columnOptionsOverrides[col.key] = dynOpts;
          }
        }
        return (
          <TableFieldInput
            columns={columns}
            rows={rows}
            onChange={(newRows) => handleChange(field.field_key, newRows)}
            readOnly={readOnly}
            columnOptionsOverrides={Object.keys(columnOptionsOverrides).length > 0 ? columnOptionsOverrides : undefined}
          />
        );
      }

      default:
        return <p className="text-muted-foreground">Tipo de campo no soportado</p>;
    }
  };

  return (
    <div className="space-y-1">
      <Label>{labelText}</Label>
      {validationHint && !readOnly && (
        <p className="text-xs text-muted-foreground">{validationHint}</p>
      )}
      {renderField()}
      {fieldError && <p className="text-xs text-destructive">{fieldError}</p>}
    </div>
  );
}
