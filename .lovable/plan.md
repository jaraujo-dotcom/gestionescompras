

## Plan: Popover formulario para filas + Segmentos de columnas en tablas

### Parte 1: Popover tipo formulario para editar filas

Agregar un boton de edicion (icono lapiz) en cada fila que abre un `Dialog` con los campos de esa fila en formato vertical, mas comodo para llenar datos. La tabla inline y copy-down se mantienen intactos.

**Cambios en `src/components/forms/DynamicFormField.tsx`:**
- Agregar estado `editingRowIdx` al componente `TableFieldInput`
- Agregar icono de lapiz (Pencil) en cada fila junto al boton de eliminar
- Crear sub-componente `RowFormDialog` que:
  - Usa `Dialog` de shadcn/ui
  - Muestra cada columna visible como campo vertical con label, input y validacion
  - Respeta visibilidad condicional, readonly, y opciones dinamicas
  - Cambios se aplican en tiempo real via `updateCell`
  - Boton "Cerrar" para cerrar el dialog
- Al agregar una nueva fila, abrir automaticamente el dialog para esa fila
- En modo `readOnly` no se muestra el boton de editar

### Parte 2: Segmentos (grupos) de columnas en tablas

Permitir agrupar columnas bajo encabezados padre en campos tipo tabla. Por ejemplo, bajo "Presupuesto" agrupar "Monto", "Moneda", "IVA".

**Cambios en tipos (`src/types/database.ts`):**
- Agregar propiedad opcional `group?: string` a `TableColumnSchema` — nombre del grupo al que pertenece la columna

**Cambios en el editor (`src/components/admin/FieldEditor.tsx`):**
- Agregar input de "Grupo" en la configuracion de cada columna de tabla (campo de texto simple)
- Las columnas con el mismo valor de grupo se agruparan visualmente

**Cambios en renderizado de tabla (`src/components/forms/DynamicFormField.tsx`):**
- En `TableHeader`, generar una fila adicional superior con `colSpan` para los encabezados de grupo
- Columnas sin grupo no tienen encabezado superior (usan `rowSpan=2`)
- Columnas del mismo grupo se agrupan consecutivamente

**Cambios en vista de solo lectura (`src/components/forms/DynamicFormView.tsx`):**
- Misma logica de encabezados agrupados para la vista de visualizacion

### Archivos a modificar
1. `src/types/database.ts` — agregar `group` a `TableColumnSchema`
2. `src/components/admin/FieldEditor.tsx` — input de grupo por columna
3. `src/components/forms/DynamicFormField.tsx` — dialog de edicion de fila + encabezados agrupados
4. `src/components/forms/DynamicFormView.tsx` — encabezados agrupados en vista lectura

### Sin cambios de base de datos
Todo se almacena en `table_schema_json` (JSONB) que ya existe, solo se agrega la propiedad `group` al JSON.

