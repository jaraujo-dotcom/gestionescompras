import { useState, useEffect } from 'react';
import { FormField, FieldRule, FieldDependency, TableColumnSchema } from '@/types/database';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Trash2, CopyCheck, Upload, X, FileText, Image, Lock, Pencil } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  normalizeRules,
  shouldShowField as shouldShowFieldFromRules,
  isFieldDynamicallyRequired,
  getFieldDynamicOptions,
  getTableColumnDynamicOptions,
  shouldShowColumn,
  isColumnDynamicallyRequired,
} from '@/lib/rules';
import { parseValidation, validateFieldValue, validateCellValue, describeValidation } from '@/lib/validations';

interface DynamicFormFieldProps {
  field: FormField;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
  allValues: Record<string, unknown>;
  readOnly?: boolean;
  externalError?: string | null;
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

// Helper to build grouped column headers
function buildGroupedHeaders(columns: TableColumnSchema[]) {
  // Build ordered list of groups/standalone cols for the top header row
  const groups: { type: 'group'; name: string; span: number }[] | { type: 'standalone'; colKey: string }[] = [];
  const topRow: ({ type: 'group'; name: string; span: number } | { type: 'standalone'; colKey: string })[] = [];

  let i = 0;
  while (i < columns.length) {
    const col = columns[i];
    if (col.group) {
      // Count consecutive columns with the same group
      let span = 0;
      const groupName = col.group;
      while (i < columns.length && columns[i].group === groupName) {
        span++;
        i++;
      }
      topRow.push({ type: 'group', name: groupName, span });
    } else {
      topRow.push({ type: 'standalone', colKey: col.key });
      i++;
    }
  }

  const hasGroups = topRow.some(item => item.type === 'group');
  return { topRow, hasGroups };
}

// Row form dialog for editing a row in vertical layout
function RowFormDialog({
  open,
  onClose,
  columns,
  row,
  rowIdx,
  updateCell,
  columnOptionsOverrides,
  allFormValues,
  cellErrors,
}: {
  open: boolean;
  onClose: () => void;
  columns: TableColumnSchema[];
  row: Record<string, unknown>;
  rowIdx: number;
  updateCell: (rowIdx: number, colKey: string, value: unknown) => void;
  columnOptionsOverrides?: Record<string, string[]>;
  allFormValues: Record<string, unknown>;
  cellErrors: Record<string, string>;
}) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Editar Fila {rowIdx + 1}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          {columns.map((col) => {
            const colVisible = shouldShowColumn(col.rules ?? [], row, allFormValues);
            if (!colVisible) return null;

            const isColReadonly = (col as any)._readonly === true;
            const colRequired = (col.required || false) || isColumnDynamicallyRequired(col.rules ?? [], row, allFormValues);
            const val = row[col.key];
            const errorKey = `${rowIdx}_${col.key}`;
            const error = cellErrors[errorKey];

            return (
              <div key={col.key} className="space-y-1.5">
                <Label className="text-sm">
                  {col.label}{colRequired ? ' *' : ''}
                  {isColReadonly && <span className="ml-1 text-muted-foreground text-xs">(solo vista)</span>}
                </Label>
                {col.type === 'text' && (
                  <Input
                    value={String(val || '')}
                    onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                    disabled={isColReadonly}
                  />
                )}
                {col.type === 'number' && (
                  <Input
                    type="number"
                    value={val !== undefined && val !== null && val !== '' ? Number(val) : ''}
                    onChange={(e) => updateCell(rowIdx, col.key, e.target.value ? parseFloat(e.target.value) : null)}
                    disabled={isColReadonly}
                  />
                )}
                {col.type === 'date' && (
                  <Input
                    type="date"
                    value={String(val || '')}
                    onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
                    disabled={isColReadonly}
                  />
                )}
                {col.type === 'boolean' && (
                  <div className="flex items-center gap-2">
                    <Checkbox
                      checked={Boolean(val)}
                      onCheckedChange={(checked) => updateCell(rowIdx, col.key, checked)}
                      disabled={isColReadonly}
                    />
                    <span className="text-sm text-muted-foreground">{val ? 'Sí' : 'No'}</span>
                  </div>
                )}
                {col.type === 'select' && (() => {
                  const opts = columnOptionsOverrides?.[col.key] ?? col.options ?? [];
                  return (
                    <Select
                      value={String(val || '')}
                      onValueChange={(v) => updateCell(rowIdx, col.key, v)}
                      disabled={isColReadonly}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {opts.map((opt) => (
                          <SelectItem key={opt} value={opt}>{opt}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  );
                })()}
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
            );
          })}
        </div>
        <div className="flex justify-end pt-2">
          <Button variant="outline" onClick={onClose}>Cerrar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TableFieldInput({
  columns,
  rows,
  onChange,
  readOnly,
  columnOptionsOverrides,
  allFormValues,
}: {
  columns: TableColumnSchema[];
  rows: Record<string, unknown>[];
  onChange: (rows: Record<string, unknown>[]) => void;
  readOnly: boolean;
  columnOptionsOverrides?: Record<string, string[]>;
  allFormValues: Record<string, unknown>;
}) {
  const [cellErrors, setCellErrors] = useState<Record<string, string>>({});
  const [editingRowIdx, setEditingRowIdx] = useState<number | null>(null);

  const addRow = () => {
    const emptyRow: Record<string, unknown> = {};
    columns.forEach((col) => {
      emptyRow[col.key] = col.type === 'boolean' ? false : '';
    });
    const newRows = [...rows, emptyRow];
    onChange(newRows);
    // Open dialog for new row
    if (!readOnly) {
      setEditingRowIdx(newRows.length - 1);
    }
  };

  const removeRow = (rowIdx: number) => {
    onChange(rows.filter((_, i) => i !== rowIdx));
    const newErrors = { ...cellErrors };
    Object.keys(newErrors).forEach((k) => {
      if (k.startsWith(`${rowIdx}_`)) delete newErrors[k];
    });
    setCellErrors(newErrors);
    if (editingRowIdx === rowIdx) setEditingRowIdx(null);
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
    const colVisible = shouldShowColumn(col.rules ?? [], row, allFormValues);
    if (!colVisible) return null;

    const isColReadonly = readOnly || (col as any)._readonly === true;
    const colRequired = (col.required || false) || isColumnDynamicallyRequired(col.rules ?? [], row, allFormValues);
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
              disabled={isColReadonly}
              className={`h-8 text-xs ${isColReadonly ? 'bg-muted/50' : ''}`}
            />
          );
        case 'number':
          return (
            <Input
              type="number"
              value={val !== undefined && val !== null && val !== '' ? Number(val) : ''}
              onChange={(e) => updateCell(rowIdx, col.key, e.target.value ? parseFloat(e.target.value) : null)}
              disabled={isColReadonly}
              className={`h-8 text-xs ${isColReadonly ? 'bg-muted/50' : ''}`}
            />
          );
        case 'date':
          return (
            <Input
              type="date"
              value={String(val || '')}
              onChange={(e) => updateCell(rowIdx, col.key, e.target.value)}
              disabled={isColReadonly}
              className={`h-8 text-xs ${isColReadonly ? 'bg-muted/50' : ''}`}
            />
          );
        case 'boolean':
          return (
            <div className="flex justify-center">
              <Checkbox
                checked={Boolean(val)}
                onCheckedChange={(checked) => updateCell(rowIdx, col.key, checked)}
                disabled={isColReadonly}
              />
            </div>
          );
        case 'select': {
          const opts = columnOptionsOverrides?.[col.key] ?? col.options ?? [];
          return (
            <Select
              value={String(val || '')}
              onValueChange={(v) => updateCell(rowIdx, col.key, v)}
              disabled={isColReadonly}
            >
              <SelectTrigger className={`h-8 text-xs ${isColReadonly ? 'bg-muted/50' : ''}`}>
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
      <div className="flex items-center gap-0.5" data-required={colRequired || undefined}>
        <div className="flex-1 relative">
          {cellContent}
          {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
        </div>
        {!isColReadonly && rowIdx < rows.length - 1 && (
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

  const isColVisibleInAnyRow = (col: TableColumnSchema): boolean => {
    if (!col.rules || col.rules.length === 0) return true;
    if (rows.length === 0) return true;
    return rows.some((row) => shouldShowColumn(col.rules!, row, allFormValues));
  };

  const visibleColumns = columns.filter(isColVisibleInAnyRow);
  const { topRow, hasGroups } = buildGroupedHeaders(visibleColumns);

  return (
    <div className="space-y-2">
      <div className="border rounded-md overflow-auto">
        <Table>
          <TableHeader>
            {/* Group header row (only if groups exist) */}
            {hasGroups && (
              <TableRow>
                <TableHead rowSpan={2} className="text-xs whitespace-nowrap w-10 text-center border-b">#</TableHead>
                {topRow.map((item, idx) => {
                  if (item.type === 'group') {
                    return (
                      <TableHead
                        key={`grp-${idx}`}
                        colSpan={item.span}
                        className="text-xs whitespace-nowrap text-center font-semibold bg-muted/50 border-b border-x"
                      >
                        {item.name}
                      </TableHead>
                    );
                  }
                  // standalone — spans 2 rows
                  const col = visibleColumns.find(c => c.key === item.colKey)!;
                  const anyRequired = col.required ||
                    rows.some((row) => isColumnDynamicallyRequired(col.rules ?? [], row, allFormValues));
                  return (
                    <TableHead key={col.key} rowSpan={2} className="text-xs whitespace-nowrap border-b">
                      {col.label}{anyRequired ? ' *' : ''}
                      {(col as any)._readonly && <span className="ml-1 text-muted-foreground text-[10px]">(info)</span>}
                    </TableHead>
                  );
                })}
                {!readOnly && <TableHead rowSpan={2} className="w-20 border-b" />}
              </TableRow>
            )}
            {/* Column labels row */}
            <TableRow>
              {!hasGroups && <TableHead className="text-xs whitespace-nowrap w-10 text-center">#</TableHead>}
              {hasGroups
                ? // Only render columns that belong to groups (standalone already rendered with rowSpan)
                  visibleColumns.filter(c => c.group).map((col) => {
                    const anyRequired = col.required ||
                      rows.some((row) => isColumnDynamicallyRequired(col.rules ?? [], row, allFormValues));
                    return (
                      <TableHead key={col.key} className="text-xs whitespace-nowrap border-x">
                        {col.label}{anyRequired ? ' *' : ''}
                        {(col as any)._readonly && <span className="ml-1 text-muted-foreground text-[10px]">(info)</span>}
                      </TableHead>
                    );
                  })
                : visibleColumns.map((col) => {
                    const anyRequired = col.required ||
                      rows.some((row) => isColumnDynamicallyRequired(col.rules ?? [], row, allFormValues));
                    return (
                      <TableHead key={col.key} className="text-xs whitespace-nowrap">
                        {col.label}{anyRequired ? ' *' : ''}
                        {(col as any)._readonly && <span className="ml-1 text-muted-foreground text-[10px]">(info)</span>}
                      </TableHead>
                    );
                  })
              }
              {!hasGroups && !readOnly && <TableHead className="w-20" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={visibleColumns.length + 2} className="text-center text-xs text-muted-foreground py-4">
                  Sin filas. {!readOnly && 'Agregue una fila para comenzar.'}
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row, rowIdx) => (
                <TableRow key={rowIdx}>
                  <TableCell className="py-1 px-2 text-center text-xs text-muted-foreground font-mono">
                    {rowIdx + 1}
                  </TableCell>
                  {columns.map((col) => {
                    const cell = renderCell(col, row, rowIdx);
                    if (cell === null) return null;
                    return (
                      <TableCell key={col.key} className="py-1 px-2">
                        {cell}
                      </TableCell>
                    );
                  })}
                  {!readOnly && (
                    <TableCell className="py-1 px-1">
                      <div className="flex items-center gap-0.5">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-primary" onClick={() => setEditingRowIdx(rowIdx)}>
                              <Pencil className="w-3 h-3" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">Editar en formulario</TooltipContent>
                        </Tooltip>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeRow(rowIdx)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
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

      {/* Row editing dialog */}
      {editingRowIdx !== null && editingRowIdx < rows.length && (
        <RowFormDialog
          open={true}
          onClose={() => setEditingRowIdx(null)}
          columns={columns}
          row={rows[editingRowIdx]}
          rowIdx={editingRowIdx}
          updateCell={updateCell}
          columnOptionsOverrides={columnOptionsOverrides}
          allFormValues={allFormValues}
          cellErrors={cellErrors}
        />
      )}
    </div>
  );
}

// File upload component
function FileFieldInput({
  value,
  onChange,
  readOnly,
  fieldKey,
}: {
  value: unknown;
  onChange: (files: { name: string; url: string; type: string; path?: string }[]) => void;
  readOnly: boolean;
  fieldKey: string;
}) {
  const [uploading, setUploading] = useState(false);
  const files: { name: string; url: string; type: string; path?: string }[] = Array.isArray(value) ? value : [];

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles || selectedFiles.length === 0) return;

    setUploading(true);
    const newFiles = [...files];

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No autenticado');

      for (const file of Array.from(selectedFiles)) {
        const path = `${user.id}/${fieldKey}/${Date.now()}_${file.name}`;

        const { error } = await supabase.storage
          .from('form-attachments')
          .upload(path, file);

        if (error) throw error;

        const { data: signedData, error: signError } = await supabase.storage
          .from('form-attachments')
          .createSignedUrl(path, 60 * 60 * 4);

        if (signError) throw signError;

        newFiles.push({
          name: file.name,
          url: signedData.signedUrl,
          type: file.type,
          path,
        });
      }

      onChange(newFiles);
    } catch (err) {
      console.error('Error uploading file:', err);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const removeFile = (idx: number) => {
    onChange(files.filter((_, i) => i !== idx));
  };

  const isImage = (type: string) => type.startsWith('image/');

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <div className="space-y-1.5">
          {files.map((file, idx) => (
            <div key={idx} className="flex items-center gap-2 p-2 rounded-md border bg-muted/30">
              {isImage(file.type) ? (
                <Image className="w-4 h-4 text-primary shrink-0" />
              ) : (
                <FileText className="w-4 h-4 text-primary shrink-0" />
              )}
              <a
                href={file.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-primary underline truncate flex-1"
              >
                {file.name}
              </a>
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 text-destructive shrink-0"
                  onClick={() => removeFile(idx)}
                >
                  <X className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
      {!readOnly && (
        <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-dashed border-input bg-background cursor-pointer hover:bg-accent/50 transition-colors">
          <Upload className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">
            {uploading ? 'Subiendo...' : 'Seleccionar archivos'}
          </span>
          <input
            type="file"
            multiple
            accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
            className="hidden"
            onChange={handleUpload}
            disabled={uploading}
          />
        </label>
      )}
    </div>
  );
}

export function DynamicFormField({
  field,
  value,
  onChange,
  allValues,
  readOnly: rawReadOnly = false,
  externalError = null,
}: DynamicFormFieldProps) {
  const readOnly = rawReadOnly || (field as any)._readonly === true;
  const [fieldError, setFieldError] = useState<string | null>(null);

  const isVisible = shouldShowField(field.dependency_json, allValues);
  const isRequired = isFieldRequired(field, allValues);
  const rules = normalizeRules(field.dependency_json);
  const dynamicOptions = getFieldDynamicOptions(rules, allValues);
  const selectOptions = dynamicOptions ?? (field.options_json || []);
  const validation = parseValidation(field.validation_json);
  const validationHint = describeValidation(field.field_type, validation);

  useEffect(() => {
    if (readOnly || !isVisible || !value || value === '') {
      setFieldError(null);
      return;
    }
    if (validation) {
      const error = validateFieldValue(value, field.field_type, validation);
      setFieldError(error);
    } else {
      setFieldError(null);
    }
  }, [value]);

  if (!isVisible) {
    return null;
  }

  const isFieldReadonly = (field as any)._readonly === true;
  const labelText = `${field.label}${isRequired ? ' *' : ''}${isFieldReadonly ? ' (solo vista)' : ''}`;

  const handleChange = (key: string, newValue: unknown) => {
    onChange(key, newValue);
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
            allFormValues={allValues}
          />
        );
      }

      case 'file':
        return (
          <FileFieldInput
            value={value}
            onChange={(files) => handleChange(field.field_key, files)}
            readOnly={readOnly}
            fieldKey={field.field_key}
          />
        );

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
      {(fieldError || externalError) && <p className="text-xs text-destructive">{fieldError || externalError}</p>}
    </div>
  );
}
