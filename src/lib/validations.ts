import { FieldValidation, TextValidation, NumberValidation, DateValidation } from '@/types/database';

/**
 * Safely cast unknown validation_json to FieldValidation or null
 */
export function parseValidation(raw: unknown): FieldValidation | null {
  if (!raw || typeof raw !== 'object') return null;
  return raw as FieldValidation;
}

/**
 * Validate a single field value against its validation config.
 * Returns an error message string, or null if valid.
 */
export function validateFieldValue(
  value: unknown,
  fieldType: string,
  validation: FieldValidation | null
): string | null {
  if (!validation) return null;
  if (value === undefined || value === null || value === '') return null;

  switch (fieldType) {
    case 'text':
      return validateText(String(value), validation as TextValidation);
    case 'number':
      return validateNumber(Number(value), validation as NumberValidation);
    case 'date':
      return validateDate(String(value), validation as DateValidation);
    default:
      return null;
  }
}

function validateText(value: string, v: TextValidation): string | null {
  if (v.minLength !== undefined && v.minLength > 0 && value.length < v.minLength) {
    return `Mínimo ${v.minLength} caracteres (actual: ${value.length})`;
  }
  if (v.maxLength !== undefined && v.maxLength > 0 && value.length > v.maxLength) {
    return `Máximo ${v.maxLength} caracteres (actual: ${value.length})`;
  }
  if (v.pattern) {
    try {
      const regex = new RegExp(v.pattern);
      if (!regex.test(value)) {
        return v.patternMessage || `No cumple el formato requerido`;
      }
    } catch {
      // invalid regex, skip
    }
  }
  return null;
}

function validateNumber(value: number, v: NumberValidation): string | null {
  if (isNaN(value)) return null;
  if (v.min !== undefined && value < v.min) {
    return `El valor mínimo es ${v.min}`;
  }
  if (v.max !== undefined && value > v.max) {
    return `El valor máximo es ${v.max}`;
  }
  return null;
}

function validateDate(value: string, v: DateValidation): string | null {
  if (!value) return null;
  if (v.minDate && value < v.minDate) {
    return `La fecha mínima es ${v.minDate}`;
  }
  if (v.maxDate && value > v.maxDate) {
    return `La fecha máxima es ${v.maxDate}`;
  }
  return null;
}

/**
 * Validate table cell value against column validation
 */
export function validateCellValue(
  value: unknown,
  colType: string,
  validation: FieldValidation | undefined | null
): string | null {
  if (!validation) return null;
  return validateFieldValue(value, colType, validation);
}

/**
 * Build a human-readable description of the validation constraints
 */
export function describeValidation(fieldType: string, validation: FieldValidation | null): string {
  if (!validation) return '';
  const parts: string[] = [];

  if (fieldType === 'text') {
    const v = validation as TextValidation;
    if (v.minLength) parts.push(`mín. ${v.minLength} car.`);
    if (v.maxLength) parts.push(`máx. ${v.maxLength} car.`);
    if (v.pattern) parts.push(`patrón: ${v.pattern}`);
  } else if (fieldType === 'number') {
    const v = validation as NumberValidation;
    if (v.min !== undefined) parts.push(`≥ ${v.min}`);
    if (v.max !== undefined) parts.push(`≤ ${v.max}`);
  } else if (fieldType === 'date') {
    const v = validation as DateValidation;
    if (v.minDate) parts.push(`desde ${v.minDate}`);
    if (v.maxDate) parts.push(`hasta ${v.maxDate}`);
  }

  return parts.join(', ');
}
