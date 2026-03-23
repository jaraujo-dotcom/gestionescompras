// Status types
export type RequestStatus =
  | 'borrador'
  | 'esperando_tercero'
  | 'en_revision'
  | 'devuelta'
  | 'aprobada'
  | 'en_ejecucion'
  | 'en_espera'
  | 'completada'
  | 'rechazada'
  | 'anulada';

export const STATUS_LABELS: Record<RequestStatus, string> = {
  borrador: 'Borrador',
  esperando_tercero: 'Esperando Tercero',
  en_revision: 'Pendiente de Aprobación',
  devuelta: 'Devuelta',
  aprobada: 'Aprobada',
  en_ejecucion: 'En Ejecución',
  en_espera: 'En Espera',
  completada: 'Completada',
  rechazada: 'Rechazada',
  anulada: 'Anulada',
};

// Role types
export type AppRole = 'solicitante' | 'revisor' | 'ejecutor' | 'administrador' | 'gerencia' | 'procesos' | 'integridad_datos';

export const ROLE_LABELS: Record<AppRole, string> = {
  solicitante: 'Solicitante',
  revisor: 'Revisor',
  ejecutor: 'Ejecutor',
  administrador: 'Administrador',
  gerencia: 'Gerencia',
  procesos: 'Procesos',
  integridad_datos: 'Integridad de Datos',
};

// Approval roles for the 3-step approval flow
export const APPROVAL_ROLES: AppRole[] = ['gerencia', 'procesos', 'integridad_datos'];

export const APPROVAL_ROLE_LABELS: Record<string, string> = {
  gerencia: 'Gerencia',
  procesos: 'Procesos',
  integridad_datos: 'Integridad de Datos',
};

export interface RequestApproval {
  id: string;
  request_id: string;
  role: string;
  approved_by: string;
  status: 'pendiente' | 'aprobada' | 'rechazada' | 'devuelta';
  comment: string | null;
  created_at: string;
  updated_at: string;
}

// Field types for dynamic forms
export type FieldType = 'text' | 'number' | 'date' | 'select' | 'boolean' | 'table' | 'file';

// Condition operator types
export type ConditionOperator = 'equals' | 'not_equals' | 'contains' | 'greater_than' | 'less_than';

// Rule effect types
export type RuleEffect = 'show' | 'required' | 'options';

// Single condition within a rule
export interface FieldCondition {
  fieldKey: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

// A rule with multiple conditions and an effect
export interface FieldRule {
  id: string;
  conditions: FieldCondition[];
  logic: 'and' | 'or';
  effect: RuleEffect;
  optionValues?: string[]; // for 'options' effect
  targetColumnKey?: string; // for 'options' effect on table fields - which column to target
  expression?: string; // raw expression for advanced mode
}

// Legacy format (kept for backward compat)
export interface FieldDependency {
  fieldKey: string;
  operator: ConditionOperator;
  value: string | number | boolean;
  effect: 'show' | 'required';
}

// Validation schemas per field type
export interface TextValidation {
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  patternMessage?: string; // custom error message for pattern
}

export interface NumberValidation {
  min?: number;
  max?: number;
}

export interface DateValidation {
  minDate?: string; // ISO date string
  maxDate?: string;
}

export type FieldValidation = TextValidation | NumberValidation | DateValidation;

// Table column schema
// External mode for table columns: how the column behaves for external guests
export type ColumnExternalMode = 'none' | 'readonly' | 'editable';

export interface TableColumnSchema {
  key: string;
  label: string;
  type: 'text' | 'number' | 'date' | 'select' | 'boolean';
  required?: boolean;
  is_external?: boolean; // legacy, kept for backward compat
  external_mode?: ColumnExternalMode; // new: none | readonly | editable
  options?: string[];
  validation?: FieldValidation;
  rules?: FieldRule[]; // conditional rules for this column
}

// Database entities
export interface Profile {
  id: string;
  name: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface UserRole {
  id: string;
  user_id: string;
  role: AppRole;
  created_at: string;
}

export interface FormSection {
  id: string;
  template_id: string;
  name: string;
  description: string | null;
  section_order: number;
  is_collapsible: boolean;
  created_at: string;
  updated_at: string;
}

export interface FormTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  default_workflow_id: string | null;
  executor_group_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  id: string;
  template_id: string;
  section_id: string | null;
  field_key: string;
  label: string;
  field_type: FieldType;
  is_required: boolean;
  placeholder: string | null;
  options_json: string[] | null;
  table_schema_json: TableColumnSchema[] | null;
  dependency_json: FieldRule[] | FieldDependency | null;
  validation_json: unknown;
  field_order: number;
  created_at: string;
  updated_at: string;
}

export interface Request {
  id: string;
  request_number: number;
  template_id: string | null;
  title: string;
  created_by: string;
  status: RequestStatus;
  data_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface RequestComment {
  id: string;
  request_id: string;
  user_id: string;
  comment: string;
  created_at: string;
}

export interface RequestItem {
  id: string;
  request_id: string;
  codigo_interno: string | null;
  nombre_articulo: string;
  categoria: string;
  unidad_medida: string;
  cantidad: number;
  precio_estimado: number | null;
  observaciones: string | null;
  item_order: number;
  created_at: string;
}

// Workflow types
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface WorkflowStep {
  id: string;
  workflow_id: string;
  step_order: number;
  role_name: string; // e.g. 'gerencia', 'procesos'
  label: string; // e.g. 'Aprobación Gerencia'
  created_at: string;
}

export interface RequestWorkflowStep {
  id: string;
  request_id: string;
  step_order: number;
  role_name: string;
  label: string;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
  approved_by: string | null;
  comment: string | null;
  created_at: string;
  updated_at: string;
}

export interface RequestStatusHistory {
  id: string;
  request_id: string;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  changed_by: string;
  comment: string | null;
  created_at: string;
}
