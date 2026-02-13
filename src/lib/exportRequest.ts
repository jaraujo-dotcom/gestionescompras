import * as XLSX from 'xlsx';
import { FormField, TableColumnSchema, STATUS_LABELS, RequestStatus } from '@/types/database';

interface ExportData {
  requestNumber: number;
  title: string;
  status: RequestStatus;
  creatorName: string;
  createdAt: string;
  templateName?: string;
  fields: FormField[];
  values: Record<string, unknown>;
  history: { date: string; user: string; status: string; comment?: string }[];
  comments: { date: string; user: string; comment: string }[];
}

function formatRequestNumber(num: number): string {
  return String(num).padStart(6, '0');
}

function getFieldDisplayValue(field: FormField, value: unknown): string {
  if (value === undefined || value === null || value === '') return '-';
  switch (field.field_type) {
    case 'boolean': return value ? 'Sí' : 'No';
    case 'date': try { return new Date(String(value)).toLocaleDateString('es-ES'); } catch { return String(value); }
    case 'number': return Number(value).toLocaleString('es-ES');
    default: return String(value);
  }
}

export function exportToExcel(data: ExportData) {
  const num = formatRequestNumber(data.requestNumber);
  const wb = XLSX.utils.book_new();

  // General info sheet
  const infoData = [
    ['Solicitud', `#${num}`],
    ['Título', data.title],
    ['Estado', STATUS_LABELS[data.status]],
    ['Solicitante', data.creatorName],
    ['Fecha', new Date(data.createdAt).toLocaleDateString('es-ES')],
    ...(data.templateName ? [['Formulario', data.templateName]] : []),
    [],
    ['--- Datos ---'],
  ];

  const nonTableFields = data.fields.filter(f => f.field_type !== 'table');
  for (const f of nonTableFields) {
    infoData.push([f.label, getFieldDisplayValue(f, data.values[f.field_key])]);
  }

  const infoSheet = XLSX.utils.aoa_to_sheet(infoData);
  XLSX.utils.book_append_sheet(wb, infoSheet, 'Información');

  // Table fields as separate sheets
  const tableFields = data.fields.filter(f => f.field_type === 'table');
  for (const tf of tableFields) {
    const cols: TableColumnSchema[] = tf.table_schema_json || [];
    const rows = Array.isArray(data.values[tf.field_key]) ? (data.values[tf.field_key] as Record<string, unknown>[]) : [];
    if (rows.length > 0) {
      const sheetData = [cols.map(c => c.label), ...rows.map(r => cols.map(c => r[c.key] != null ? r[c.key] : ''))];
      const sheet = XLSX.utils.aoa_to_sheet(sheetData as any[][]);
      XLSX.utils.book_append_sheet(wb, sheet, tf.label.substring(0, 31));
    }
  }

  // History sheet
  if (data.history.length > 0) {
    const histData = [['Fecha', 'Usuario', 'Estado', 'Comentario'], ...data.history.map(h => [h.date, h.user, h.status, h.comment || ''])];
    const histSheet = XLSX.utils.aoa_to_sheet(histData);
    XLSX.utils.book_append_sheet(wb, histSheet, 'Historial');
  }

  // Comments sheet
  if (data.comments.length > 0) {
    const commData = [['Fecha', 'Usuario', 'Comentario'], ...data.comments.map(c => [c.date, c.user, c.comment])];
    const commSheet = XLSX.utils.aoa_to_sheet(commData);
    XLSX.utils.book_append_sheet(wb, commSheet, 'Seguimiento');
  }

  XLSX.writeFile(wb, `solicitud_${num}.xlsx`);
}
