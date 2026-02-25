import { FieldRule, FieldDependency, FieldCondition, ConditionOperator, RuleEffect } from '@/types/database';

// --- Backward compatibility ---

export function isLegacyDependency(dep: unknown): dep is FieldDependency {
  return (
    dep !== null &&
    typeof dep === 'object' &&
    !Array.isArray(dep) &&
    'fieldKey' in (dep as Record<string, unknown>) &&
    'operator' in (dep as Record<string, unknown>)
  );
}

export function migrateLegacyDependency(dep: FieldDependency): FieldRule[] {
  return [
    {
      id: 'migrated_1',
      conditions: [
        {
          fieldKey: dep.fieldKey,
          operator: dep.operator,
          value: dep.value,
        },
      ],
      logic: 'and',
      effect: dep.effect,
    },
  ];
}

export function normalizeRules(dep: FieldRule[] | FieldDependency | null): FieldRule[] {
  if (!dep) return [];
  if (isLegacyDependency(dep)) return migrateLegacyDependency(dep);
  if (Array.isArray(dep)) return dep as FieldRule[];
  return [];
}

// --- Condition evaluation ---

function evaluateCondition(
  condition: FieldCondition,
  allValues: Record<string, unknown>
): boolean {
  const actual = allValues[condition.fieldKey];
  const expected = condition.value;

  switch (condition.operator) {
    case 'equals':
      return String(actual) === String(expected);
    case 'not_equals':
      return String(actual) !== String(expected);
    case 'contains':
      return String(actual ?? '').toLowerCase().includes(String(expected).toLowerCase());
    case 'greater_than':
      return Number(actual) > Number(expected);
    case 'less_than':
      return Number(actual) < Number(expected);
    default:
      return true;
  }
}

function evaluateRuleConditions(rule: FieldRule, allValues: Record<string, unknown>): boolean {
  // If expression mode, parse and evaluate
  if (rule.expression) {
    return evaluateExpression(rule.expression, allValues);
  }

  if (rule.conditions.length === 0) return true;

  if (rule.logic === 'or') {
    return rule.conditions.some((c) => evaluateCondition(c, allValues));
  }
  return rule.conditions.every((c) => evaluateCondition(c, allValues));
}

// --- Public API ---

export function shouldShowField(
  rules: FieldRule[],
  allValues: Record<string, unknown>
): boolean {
  const showRules = rules.filter((r) => r.effect === 'show');
  if (showRules.length === 0) return true; // no show rules = always visible
  return showRules.some((r) => evaluateRuleConditions(r, allValues));
}

export function isFieldDynamicallyRequired(
  rules: FieldRule[],
  allValues: Record<string, unknown>
): boolean {
  const reqRules = rules.filter((r) => r.effect === 'required');
  return reqRules.some((r) => evaluateRuleConditions(r, allValues));
}

export function getFieldDynamicOptions(
  rules: FieldRule[],
  allValues: Record<string, unknown>
): string[] | null {
  const optionRules = rules.filter((r) => r.effect === 'options' && !r.targetColumnKey);
  for (const rule of optionRules) {
    if (evaluateRuleConditions(rule, allValues)) {
      return rule.optionValues || [];
    }
  }
  return null;
}

export function getTableColumnDynamicOptions(
  rules: FieldRule[],
  allValues: Record<string, unknown>,
  columnKey: string
): string[] | null {
  const optionRules = rules.filter((r) => r.effect === 'options' && r.targetColumnKey === columnKey);
  for (const rule of optionRules) {
    if (evaluateRuleConditions(rule, allValues)) {
      return rule.optionValues || [];
    }
  }
  return null;
}

// --- Column-level rule helpers ---
// These merge current row values with global form values so conditions can
// reference both sibling columns (by their key) and top-level form fields.

function mergedContext(
  rowValues: Record<string, unknown>,
  formValues: Record<string, unknown>
): Record<string, unknown> {
  return { ...formValues, ...rowValues };
}

export function shouldShowColumn(
  rules: FieldRule[],
  rowValues: Record<string, unknown>,
  formValues: Record<string, unknown>
): boolean {
  const showRules = rules.filter((r) => r.effect === 'show');
  if (showRules.length === 0) return true;
  const ctx = mergedContext(rowValues, formValues);
  return showRules.some((r) => evaluateRuleConditions(r, ctx));
}

export function isColumnDynamicallyRequired(
  rules: FieldRule[],
  rowValues: Record<string, unknown>,
  formValues: Record<string, unknown>
): boolean {
  const reqRules = rules.filter((r) => r.effect === 'required');
  const ctx = mergedContext(rowValues, formValues);
  return reqRules.some((r) => evaluateRuleConditions(r, ctx));
}

// --- Expression parser ---

const TOKEN_REGEX =
  /(\(|\)|&&|\|\||AND|OR|==|!=|>=|<=|>|<|contains\s*\(|"[^"]*"|'[^']*'|\d+(?:\.\d+)?|true|false|[a-zA-Z_]\w*)/gi;

interface ParsedExpr {
  type: 'condition' | 'and' | 'or';
  left?: ParsedExpr;
  right?: ParsedExpr;
  fieldKey?: string;
  operator?: ConditionOperator;
  value?: string | number | boolean;
}

function tokenize(expr: string): string[] {
  const matches = expr.match(TOKEN_REGEX);
  return matches ? matches.map((t) => t.trim()).filter(Boolean) : [];
}

function parseValue(token: string): string | number | boolean {
  if (token === 'true') return true;
  if (token === 'false') return false;
  if (/^["']/.test(token)) return token.slice(1, -1);
  if (!isNaN(Number(token))) return Number(token);
  return token;
}

function parseTokens(tokens: string[], pos: { i: number }): ParsedExpr {
  let left = parseComparison(tokens, pos);

  while (pos.i < tokens.length) {
    const next = tokens[pos.i]?.toUpperCase();
    if (next === 'AND' || next === '&&') {
      pos.i++;
      const right = parseComparison(tokens, pos);
      left = { type: 'and', left, right };
    } else if (next === 'OR' || next === '||') {
      pos.i++;
      const right = parseComparison(tokens, pos);
      left = { type: 'or', left, right };
    } else {
      break;
    }
  }
  return left;
}

function parseComparison(tokens: string[], pos: { i: number }): ParsedExpr {
  if (tokens[pos.i] === '(') {
    pos.i++;
    const expr = parseTokens(tokens, pos);
    if (tokens[pos.i] === ')') pos.i++;
    return expr;
  }

  // contains(fieldKey, "value")
  if (tokens[pos.i]?.toLowerCase().startsWith('contains')) {
    pos.i++; // skip "contains("
    const fieldKey = tokens[pos.i++];
    // skip comma if next token starts with it
    const valToken = tokens[pos.i++];
    if (tokens[pos.i] === ')') pos.i++;
    return {
      type: 'condition',
      fieldKey,
      operator: 'contains',
      value: parseValue(valToken),
    };
  }

  const fieldKey = tokens[pos.i++];
  const opToken = tokens[pos.i++];
  const valToken = tokens[pos.i++];

  let operator: ConditionOperator = 'equals';
  switch (opToken) {
    case '==':
      operator = 'equals';
      break;
    case '!=':
      operator = 'not_equals';
      break;
    case '>':
      operator = 'greater_than';
      break;
    case '<':
      operator = 'less_than';
      break;
  }

  return {
    type: 'condition',
    fieldKey,
    operator,
    value: parseValue(valToken),
  };
}

function evalParsed(parsed: ParsedExpr, allValues: Record<string, unknown>): boolean {
  if (parsed.type === 'and') {
    return evalParsed(parsed.left!, allValues) && evalParsed(parsed.right!, allValues);
  }
  if (parsed.type === 'or') {
    return evalParsed(parsed.left!, allValues) || evalParsed(parsed.right!, allValues);
  }
  return evaluateCondition(
    {
      fieldKey: parsed.fieldKey!,
      operator: parsed.operator!,
      value: parsed.value!,
    },
    allValues
  );
}

export function evaluateExpression(expression: string, allValues: Record<string, unknown>): boolean {
  try {
    const tokens = tokenize(expression);
    if (tokens.length === 0) return true;
    const pos = { i: 0 };
    const parsed = parseTokens(tokens, pos);
    return evalParsed(parsed, allValues);
  } catch {
    console.warn('Failed to parse expression:', expression);
    return true;
  }
}

// --- Expression serialization (from conditions) ---

export function conditionsToExpression(conditions: FieldCondition[], logic: 'and' | 'or'): string {
  const parts = conditions.map((c) => {
    const val = typeof c.value === 'string' ? `"${c.value}"` : String(c.value);
    switch (c.operator) {
      case 'equals':
        return `${c.fieldKey} == ${val}`;
      case 'not_equals':
        return `${c.fieldKey} != ${val}`;
      case 'greater_than':
        return `${c.fieldKey} > ${val}`;
      case 'less_than':
        return `${c.fieldKey} < ${val}`;
      case 'contains':
        return `contains(${c.fieldKey}, ${val})`;
      default:
        return `${c.fieldKey} == ${val}`;
    }
  });
  const connector = logic === 'or' ? ' OR ' : ' AND ';
  return parts.join(connector);
}
