import ExcelJS from 'exceljs';
import { FormField, TableColumnSchema } from '@/types/database';

/**
 * Generate a downloadable Excel template from form fields.
 * - Non-table fields go into a "Datos" sheet as key-value pairs (Label | Value).
 * - Table fields get their own sheet with column headers.
 */
export async function downloadFormTemplate(
  fields: FormField[],
  templateName: string
) {
  const workbook = new ExcelJS.Workbook();

  // --- Main data sheet ---
  const dataSheet = workbook.addWorksheet('Datos');

  // Header row
  const headerRow = dataSheet.addRow(['Campo', 'Valor']);
  headerRow.font = { bold: true };
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' },
    };
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
  });

  const nonTableFields = fields
    .filter((f) => f.field_type !== 'table' && f.field_type !== 'file')
    .sort((a, b) => a.field_order - b.field_order);

  for (const field of nonTableFields) {
    const row = dataSheet.addRow([field.label, '']);
    // Store the field_key in a hidden way via row metadata (we use column C hidden)
    row.getCell(3).value = field.field_key;
    row.getCell(3).font = { color: { argb: 'FF999999' } };

    // Add data validation hints
    if (field.field_type === 'select' && field.options_json?.length) {
      row.getCell(2).dataValidation = {
        type: 'list',
        allowBlank: !field.is_required,
        formulae: [`"${field.options_json.join(',')}"`],
        showErrorMessage: true,
        errorTitle: 'Valor inválido',
        error: `Seleccione una opción válida: ${field.options_json.join(', ')}`,
      };
    } else if (field.field_type === 'boolean') {
      row.getCell(2).dataValidation = {
        type: 'list',
        allowBlank: !field.is_required,
        formulae: ['"Sí,No"'],
      };
    } else if (field.field_type === 'date') {
      row.getCell(2).numFmt = 'yyyy-mm-dd';
      row.getCell(2).note = 'Formato: AAAA-MM-DD';
    } else if (field.field_type === 'number') {
      row.getCell(2).note = 'Solo números';
    }

    // Mark required
    if (field.is_required) {
      row.getCell(1).font = { bold: true };
      row.getCell(1).value = `${field.label} *`;
    }
  }

  // Set column widths
  dataSheet.getColumn(1).width = 30;
  dataSheet.getColumn(2).width = 40;
  dataSheet.getColumn(3).width = 20;
  // Hide field_key column
  dataSheet.getColumn(3).hidden = true;

  // --- Table fields as separate sheets ---
  const tableFields = fields
    .filter((f) => f.field_type === 'table')
    .sort((a, b) => a.field_order - b.field_order);

  const usedSheetNames = new Set<string>(['Datos']);

  for (const tf of tableFields) {
    const cols: TableColumnSchema[] = tf.table_schema_json || [];
    if (cols.length === 0) continue;

    let sheetName = tf.label.substring(0, 28);
    let counter = 1;
    while (usedSheetNames.has(sheetName)) {
      sheetName = `${tf.label.substring(0, 25)}_${counter++}`;
    }
    usedSheetNames.add(sheetName);

    const sheet = workbook.addWorksheet(sheetName);

    // Store field_key in cell A1 of a hidden row or as sheet property
    // We'll use a hidden first row
    const metaRow = sheet.addRow([`__field_key:${tf.field_key}`]);
    metaRow.hidden = true;

    // Header row
    const hdr = sheet.addRow(cols.map((c) => `${c.label}${c.required ? ' *' : ''}`));
    hdr.font = { bold: true };
    hdr.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' },
      };
      cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    });

    // Hidden row with column keys
    const keyRow = sheet.addRow(cols.map((c) => c.key));
    keyRow.hidden = true;

    // Add 10 empty rows for data entry
    for (let i = 0; i < 10; i++) {
      const emptyRow = sheet.addRow(cols.map(() => ''));
      // Add data validation per column
      cols.forEach((col, colIdx) => {
        const cell = emptyRow.getCell(colIdx + 1);
        if (col.type === 'select' && col.options?.length) {
          cell.dataValidation = {
            type: 'list',
            allowBlank: !col.required,
            formulae: [`"${col.options.join(',')}"`],
          };
        } else if (col.type === 'boolean') {
          cell.dataValidation = {
            type: 'list',
            allowBlank: true,
            formulae: ['"Sí,No"'],
          };
        } else if (col.type === 'date') {
          cell.numFmt = 'yyyy-mm-dd';
        }
      });
    }

    // Set column widths
    cols.forEach((_, idx) => {
      sheet.getColumn(idx + 1).width = 20;
    });
  }

  // Download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `plantilla_${templateName.replace(/\s+/g, '_').toLowerCase()}.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * Parse an uploaded Excel file and extract form values matching the fields.
 */
export async function parseExcelFormData(
  file: File,
  fields: FormField[]
): Promise<Record<string, unknown>> {
  const workbook = new ExcelJS.Workbook();
  const buffer = await file.arrayBuffer();
  await workbook.xlsx.load(buffer);

  const values: Record<string, unknown> = {};

  // Build field lookup by key and label
  const fieldByKey = new Map<string, FormField>();
  const fieldByLabel = new Map<string, FormField>();
  for (const f of fields) {
    fieldByKey.set(f.field_key, f);
    fieldByLabel.set(f.label, f);
    fieldByLabel.set(`${f.label} *`, f); // required variant
  }

  // --- Parse "Datos" sheet ---
  const dataSheet = workbook.getWorksheet('Datos');
  if (dataSheet) {
    dataSheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // skip header

      const rawLabel = String(row.getCell(1).value || '').trim();
      const rawValue = row.getCell(2).value;
      const fieldKey = String(row.getCell(3).value || '').trim();

      // Try to find field by key first, then by label
      const field = fieldByKey.get(fieldKey) || fieldByLabel.get(rawLabel);
      if (!field || field.field_type === 'table' || field.field_type === 'file') return;

      const cellValue = parseCellValue(rawValue, field.field_type);
      if (cellValue !== null && cellValue !== undefined && cellValue !== '') {
        values[field.field_key] = cellValue;
      }
    });
  }

  // --- Parse table sheets ---
  const tableFields = fields.filter((f) => f.field_type === 'table');

  for (const tf of tableFields) {
    const cols: TableColumnSchema[] = tf.table_schema_json || [];
    if (cols.length === 0) continue;

    // Find matching sheet by field_key metadata or by label
    let sheet: ExcelJS.Worksheet | undefined;

    workbook.eachSheet((ws) => {
      if (sheet) return;
      // Check hidden first row for field_key
      const firstRow = ws.getRow(1);
      const firstVal = String(firstRow.getCell(1).value || '');
      if (firstVal === `__field_key:${tf.field_key}`) {
        sheet = ws;
        return;
      }
      // Fallback: match by sheet name
      if (ws.name === tf.label.substring(0, 28)) {
        sheet = ws;
      }
    });

    if (!sheet) continue;

    // Determine column key mapping
    // Check if row 3 has column keys (hidden)
    const keyRow = sheet.getRow(3);
    const colKeys: string[] = [];
    let hasKeyRow = false;

    cols.forEach((col, idx) => {
      const val = String(keyRow.getCell(idx + 1).value || '').trim();
      if (val && cols.some((c) => c.key === val)) {
        colKeys.push(val);
        hasKeyRow = true;
      } else {
        colKeys.push(col.key); // fallback to order-based
      }
    });

    const dataStartRow = hasKeyRow ? 4 : 3;
    const rows: Record<string, unknown>[] = [];

    sheet.eachRow((row, rowNumber) => {
      if (rowNumber < dataStartRow) return;

      const rowData: Record<string, unknown> = {};
      let hasData = false;

      cols.forEach((col, idx) => {
        const key = hasKeyRow ? colKeys[idx] : col.key;
        const cellValue = parseCellValue(row.getCell(idx + 1).value, col.type);
        rowData[key] = cellValue ?? (col.type === 'boolean' ? false : '');
        if (cellValue !== null && cellValue !== undefined && cellValue !== '' && cellValue !== false) {
          hasData = true;
        }
      });

      if (hasData) {
        rows.push(rowData);
      }
    });

    if (rows.length > 0) {
      values[tf.field_key] = rows;
    }
  }

  return values;
}

function parseCellValue(
  raw: ExcelJS.CellValue,
  fieldType: string
): unknown {
  if (raw === null || raw === undefined) return null;

  switch (fieldType) {
    case 'boolean': {
      if (typeof raw === 'boolean') return raw;
      const str = String(raw).toLowerCase().trim();
      if (str === 'sí' || str === 'si' || str === 'true' || str === '1') return true;
      if (str === 'no' || str === 'false' || str === '0') return false;
      return null;
    }
    case 'number': {
      if (typeof raw === 'number') return raw;
      const num = Number(raw);
      return isNaN(num) ? null : num;
    }
    case 'date': {
      if (raw instanceof Date) {
        return raw.toISOString().split('T')[0];
      }
      const str = String(raw).trim();
      // Try parsing as date
      const d = new Date(str);
      if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
      return str || null;
    }
    case 'select':
    case 'text':
    default:
      return String(raw).trim() || null;
  }
}
