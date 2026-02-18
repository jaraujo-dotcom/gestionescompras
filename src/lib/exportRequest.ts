import ExcelJS from 'exceljs';
import { FormField, TableColumnSchema, STATUS_LABELS, RequestStatus } from '@/types/database';

interface ExportData {
  requestNumber: number;
  title: string;
  status: RequestStatus;
  creatorName: string;
  createdAt: string;
  templateName?: string;
  groupName?: string;
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

export async function exportToExcel(data: ExportData) {
  const num = formatRequestNumber(data.requestNumber);
  const workbook = new ExcelJS.Workbook();

  // General info sheet
  const infoSheet = workbook.addWorksheet('Información');

  const infoRows: (string | undefined)[][] = [
    ['Solicitud', `#${num}`],
    ['Título', data.title],
    ['Estado', STATUS_LABELS[data.status]],
    ['Solicitante', data.creatorName],
    ['Fecha', new Date(data.createdAt).toLocaleDateString('es-ES')],
    ...(data.templateName ? [['Formulario', data.templateName]] : []),
    ...(data.groupName ? [['Grupo', data.groupName]] : []),
    [],
    ['--- Datos ---'],
  ];

  const nonTableFields = data.fields.filter(f => f.field_type !== 'table');
  for (const f of nonTableFields) {
    infoRows.push([f.label, getFieldDisplayValue(f, data.values[f.field_key])]);
  }

  for (const row of infoRows) {
    infoSheet.addRow(row);
  }

  // Table fields as separate sheets
  const tableFields = data.fields.filter(f => f.field_type === 'table');
  for (const tf of tableFields) {
    const cols: TableColumnSchema[] = tf.table_schema_json || [];
    const rows = Array.isArray(data.values[tf.field_key])
      ? (data.values[tf.field_key] as Record<string, unknown>[])
      : [];
    if (rows.length > 0) {
      const sheet = workbook.addWorksheet(tf.label.substring(0, 31));
      sheet.addRow(cols.map(c => c.label));
      for (const r of rows) {
        sheet.addRow(cols.map(c => (r[c.key] != null ? String(r[c.key]) : '')));
      }
    }
  }

  // History sheet
  if (data.history.length > 0) {
    const histSheet = workbook.addWorksheet('Historial');
    histSheet.addRow(['Fecha', 'Usuario', 'Estado', 'Comentario']);
    for (const h of data.history) {
      histSheet.addRow([h.date, h.user, h.status, h.comment || '']);
    }
  }

  // Comments sheet
  if (data.comments.length > 0) {
    const commSheet = workbook.addWorksheet('Seguimiento');
    commSheet.addRow(['Fecha', 'Usuario', 'Comentario']);
    for (const c of data.comments) {
      commSheet.addRow([c.date, c.user, c.comment]);
    }
  }

  // Write to buffer and trigger download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `solicitud_${num}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}
