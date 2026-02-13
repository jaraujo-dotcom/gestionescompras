import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { FieldValidation, TextValidation, NumberValidation, DateValidation } from '@/types/database';

interface ValidationEditorProps {
  fieldType: string;
  validation: FieldValidation | null;
  onChange: (validation: FieldValidation | null) => void;
}

export function ValidationEditor({ fieldType, validation, onChange }: ValidationEditorProps) {
  if (fieldType === 'boolean' || fieldType === 'select') {
    return null;
  }

  const update = (partial: Partial<FieldValidation>) => {
    const current = validation || {};
    const merged = { ...current, ...partial };
    // Remove empty/undefined values
    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([, v]) => v !== undefined && v !== '' && v !== null)
    );
    onChange(Object.keys(cleaned).length > 0 ? cleaned : null);
  };

  if (fieldType === 'text') {
    const v = (validation as TextValidation) || {};
    return (
      <div className="grid grid-cols-4 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Mín. caracteres</Label>
          <Input
            type="number"
            min={0}
            value={v.minLength ?? ''}
            onChange={(e) => update({ minLength: e.target.value ? parseInt(e.target.value) : undefined })}
            className="h-8 text-xs"
            placeholder="0"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Máx. caracteres</Label>
          <Input
            type="number"
            min={0}
            value={v.maxLength ?? ''}
            onChange={(e) => update({ maxLength: e.target.value ? parseInt(e.target.value) : undefined })}
            className="h-8 text-xs"
            placeholder="∞"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Patrón (regex)</Label>
          <Input
            value={v.pattern ?? ''}
            onChange={(e) => update({ pattern: e.target.value || undefined })}
            className="h-8 text-xs"
            placeholder="^[A-Z].*"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Msg. patrón</Label>
          <Input
            value={v.patternMessage ?? ''}
            onChange={(e) => update({ patternMessage: e.target.value || undefined })}
            className="h-8 text-xs"
            placeholder="Formato inválido"
          />
        </div>
      </div>
    );
  }

  if (fieldType === 'number') {
    const v = (validation as NumberValidation) || {};
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Valor mínimo</Label>
          <Input
            type="number"
            value={v.min ?? ''}
            onChange={(e) => update({ min: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="h-8 text-xs"
            placeholder="-∞"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Valor máximo</Label>
          <Input
            type="number"
            value={v.max ?? ''}
            onChange={(e) => update({ max: e.target.value ? parseFloat(e.target.value) : undefined })}
            className="h-8 text-xs"
            placeholder="∞"
          />
        </div>
      </div>
    );
  }

  if (fieldType === 'date') {
    const v = (validation as DateValidation) || {};
    return (
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-xs">Fecha mínima</Label>
          <Input
            type="date"
            value={v.minDate ?? ''}
            onChange={(e) => update({ minDate: e.target.value || undefined })}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fecha máxima</Label>
          <Input
            type="date"
            value={v.maxDate ?? ''}
            onChange={(e) => update({ maxDate: e.target.value || undefined })}
            className="h-8 text-xs"
          />
        </div>
      </div>
    );
  }

  if (fieldType === 'table') {
    return (
      <p className="text-xs text-muted-foreground italic">
        Configure validaciones en cada columna de la tabla individualmente.
      </p>
    );
  }

  return null;
}
