import { useState } from 'react';
import { FieldRule, FieldCondition, ConditionOperator, RuleEffect, TableColumnSchema } from '@/types/database';
import { FieldDraft } from './FieldEditor';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Trash2, Code, LayoutList } from 'lucide-react';
import { conditionsToExpression } from '@/lib/rules';

const OPERATORS: { value: ConditionOperator; label: string }[] = [
  { value: 'equals', label: 'Es igual a' },
  { value: 'not_equals', label: 'No es igual a' },
  { value: 'contains', label: 'Contiene' },
  { value: 'greater_than', label: 'Mayor que' },
  { value: 'less_than', label: 'Menor que' },
];

const EFFECTS: { value: RuleEffect; label: string }[] = [
  { value: 'show', label: 'Mostrar campo' },
  { value: 'required', label: 'Hacer requerido' },
  { value: 'options', label: 'Cambiar opciones' },
];

interface RuleBuilderProps {
  rules: FieldRule[];
  onChange: (rules: FieldRule[]) => void;
  availableFields: FieldDraft[];
  currentFieldType: string;
  tableColumns?: TableColumnSchema[];
}

export function RuleBuilder({ rules, onChange, availableFields, currentFieldType, tableColumns = [] }: RuleBuilderProps) {
  const addRule = () => {
    const newRule: FieldRule = {
      id: `rule_${Date.now()}`,
      conditions: [{ fieldKey: '', operator: 'equals', value: '' }],
      logic: 'and',
      effect: 'show',
    };
    onChange([...rules, newRule]);
  };

  const updateRule = (ruleIdx: number, updates: Partial<FieldRule>) => {
    const updated = [...rules];
    updated[ruleIdx] = { ...updated[ruleIdx], ...updates };
    onChange(updated);
  };

  const removeRule = (ruleIdx: number) => {
    onChange(rules.filter((_, i) => i !== ruleIdx));
  };

  const addCondition = (ruleIdx: number) => {
    const updated = [...rules];
    updated[ruleIdx] = {
      ...updated[ruleIdx],
      conditions: [...updated[ruleIdx].conditions, { fieldKey: '', operator: 'equals', value: '' }],
    };
    onChange(updated);
  };

  const updateCondition = (ruleIdx: number, condIdx: number, updates: Partial<FieldCondition>) => {
    const updated = [...rules];
    const conditions = [...updated[ruleIdx].conditions];
    conditions[condIdx] = { ...conditions[condIdx], ...updates };
    updated[ruleIdx] = { ...updated[ruleIdx], conditions };
    onChange(updated);
  };

  const removeCondition = (ruleIdx: number, condIdx: number) => {
    const updated = [...rules];
    updated[ruleIdx] = {
      ...updated[ruleIdx],
      conditions: updated[ruleIdx].conditions.filter((_, i) => i !== condIdx),
    };
    onChange(updated);
  };

  // Show 'options' effect for select and table fields
  const filteredEffects = (currentFieldType === 'select' || currentFieldType === 'table')
    ? EFFECTS
    : EFFECTS.filter((e) => e.value !== 'options');

  const selectColumnsInTable = tableColumns.filter((c) => c.type === 'select');

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          Define reglas para controlar visibilidad, obligatoriedad u opciones dinámicas
        </p>
        <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRule}>
          <Plus className="w-3 h-3 mr-1" /> Agregar regla
        </Button>
      </div>

      {rules.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-3">
          Sin reglas configuradas
        </p>
      )}

      {rules.map((rule, ruleIdx) => (
        <div key={rule.id} className="p-3 rounded-md border bg-background space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium">Regla {ruleIdx + 1}</span>
            <div className="flex items-center gap-2">
              <Select
                value={rule.effect}
                onValueChange={(val: RuleEffect) => updateRule(ruleIdx, { effect: val })}
              >
                <SelectTrigger className="h-7 text-xs w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {filteredEffects.map((ef) => (
                    <SelectItem key={ef.value} value={ef.value}>{ef.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={() => removeRule(ruleIdx)}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            </div>
          </div>

          <Tabs defaultValue={rule.expression ? 'expression' : 'visual'} className="w-full">
            <TabsList className="h-7">
              <TabsTrigger value="visual" className="text-xs h-6 gap-1">
                <LayoutList className="w-3 h-3" /> Visual
              </TabsTrigger>
              <TabsTrigger value="expression" className="text-xs h-6 gap-1">
                <Code className="w-3 h-3" /> Expresión
              </TabsTrigger>
            </TabsList>

            <TabsContent value="visual" className="space-y-2 mt-2">
              {rule.conditions.length > 1 && (
                <div className="flex items-center gap-2">
                  <Label className="text-xs">Lógica:</Label>
                  <Select
                    value={rule.logic}
                    onValueChange={(val: 'and' | 'or') => updateRule(ruleIdx, { logic: val })}
                  >
                    <SelectTrigger className="h-7 text-xs w-[100px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="and">Y (AND)</SelectItem>
                      <SelectItem value="or">O (OR)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {rule.conditions.map((cond, condIdx) => (
                <div key={condIdx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                  <div className="space-y-1">
                    <Label className="text-xs">Campo</Label>
                    <Select
                      value={cond.fieldKey}
                      onValueChange={(val) => updateCondition(ruleIdx, condIdx, { fieldKey: val })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Seleccionar..." />
                      </SelectTrigger>
                      <SelectContent>
                        {availableFields.map((f) => (
                          <SelectItem key={f.field_key} value={f.field_key}>
                            {f.label || f.field_key}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Operador</Label>
                    <Select
                      value={cond.operator}
                      onValueChange={(val: ConditionOperator) =>
                        updateCondition(ruleIdx, condIdx, { operator: val })
                      }
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {OPERATORS.map((op) => (
                          <SelectItem key={op.value} value={op.value}>{op.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Valor</Label>
                    <Input
                      value={String(cond.value ?? '')}
                      onChange={(e) => updateCondition(ruleIdx, condIdx, { value: e.target.value })}
                      placeholder="Valor"
                      className="h-8 text-xs"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => removeCondition(ruleIdx, condIdx)}
                    disabled={rule.conditions.length <= 1}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              ))}

              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs"
                onClick={() => addCondition(ruleIdx)}
              >
                <Plus className="w-3 h-3 mr-1" /> Agregar condición
              </Button>

              {rule.conditions.length > 0 && rule.conditions[0].fieldKey && (
                <p className="text-[10px] text-muted-foreground font-mono bg-muted/50 rounded px-2 py-1">
                  {conditionsToExpression(rule.conditions, rule.logic)}
                </p>
              )}
            </TabsContent>

            <TabsContent value="expression" className="mt-2">
              <div className="space-y-1">
                <Label className="text-xs">
                  Expresión (use: campo == "valor" AND/OR campo2 {'>'} 10)
                </Label>
                <Textarea
                  value={rule.expression || conditionsToExpression(rule.conditions, rule.logic)}
                  onChange={(e) => updateRule(ruleIdx, { expression: e.target.value })}
                  placeholder='campo_tipo == "urgente" AND campo_monto > 1000'
                  rows={2}
                  className="text-xs font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  Operadores: == != {'>'} {'<'} contains(campo, "texto") · Lógica: AND OR · Agrupar: ( )
                </p>
              </div>
            </TabsContent>
          </Tabs>

          {/* Options values for 'options' effect */}
          {rule.effect === 'options' && (
            <div className="space-y-2">
              {currentFieldType === 'table' && selectColumnsInTable.length > 0 && (
                <div className="space-y-1">
                  <Label className="text-xs">Columna objetivo</Label>
                  <Select
                    value={rule.targetColumnKey || ''}
                    onValueChange={(val) => updateRule(ruleIdx, { targetColumnKey: val })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="Seleccionar columna..." />
                    </SelectTrigger>
                    <SelectContent>
                      {selectColumnsInTable.map((col) => (
                        <SelectItem key={col.key} value={col.key}>{col.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="space-y-1">
                <Label className="text-xs">Opciones cuando se cumple la regla (separadas por coma)</Label>
                <Input
                  value={(rule.optionValues || []).join(', ')}
                  onChange={(e) =>
                    updateRule(ruleIdx, {
                      optionValues: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
                    })
                  }
                  placeholder="Opción A, Opción B, Opción C"
                  className="h-8 text-xs"
                />
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
