import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { FieldEditor, FieldDraft, SectionDraft } from './FieldEditor';

interface SortableFieldItemProps {
  id: string;
  field: FieldDraft;
  index: number;
  allFields: FieldDraft[];
  sections: SectionDraft[];
  onUpdate: (index: number, updates: Partial<FieldDraft>) => void;
  onRemove: (index: number) => void;
  onClone: (index: number) => void;
}

export function SortableFieldItem({ id, field, index, allFields, sections, onUpdate, onRemove, onClone }: SortableFieldItemProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 10 : undefined,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <FieldEditor
        field={field}
        index={index}
        allFields={allFields}
        sections={sections}
        onUpdate={onUpdate}
        onRemove={onRemove}
        onClone={onClone}
        dragHandleProps={{ ...attributes, ...listeners }}
      />
    </div>
  );
}
