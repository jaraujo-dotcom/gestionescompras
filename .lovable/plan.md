

## Plan: Hacer estáticos los datos de formularios en solicitudes

### Problema actual
Cuando se visualiza una solicitud, el sistema carga los campos (`form_fields`) y secciones (`form_sections`) **en vivo** desde la plantilla. Si un admin modifica la plantilla después, las solicitudes antiguas se ven con la estructura nueva (campos nuevos vacíos, campos eliminados desaparecen, etc.).

### Solución
Guardar una **snapshot** (copia) de los campos y secciones en el momento de crear/enviar la solicitud. Al visualizar, usar la snapshot en lugar de la plantilla actual.

### Cambios

**1. Migración de base de datos**
- Agregar dos columnas a la tabla `requests`:
  - `fields_snapshot_json` (jsonb, nullable) — copia de los campos del formulario
  - `sections_snapshot_json` (jsonb, nullable) — copia de las secciones

**2. NewRequest.tsx — Guardar snapshot al crear**
- Al hacer `insert` de la solicitud, incluir `fields_snapshot_json` con el array de campos y `sections_snapshot_json` con el array de secciones tal como están en ese momento.

**3. RequestDetail.tsx — Usar snapshot para visualización**
- Al cargar la solicitud, verificar si `fields_snapshot_json` existe:
  - **Sí**: usar esos campos/secciones para el `DynamicFormView` (solicitudes nuevas)
  - **No**: cargar desde la plantilla como fallback (solicitudes antiguas creadas antes de este cambio)

**4. EditRequest.tsx — Usar snapshot para edición**
- Misma lógica: si existe snapshot, usar esos campos para el formulario de edición. Si no, fallback a la plantilla actual.
- Al guardar cambios en un borrador/devuelta, actualizar también el snapshot con los campos actuales de la plantilla (para que refleje la versión más reciente al momento de la última edición).

**5. exportRequest.ts — Sin cambios**
- Ya recibe `fields` como parámetro, así que automáticamente usará lo que le pase el caller (snapshot o live).

### Comportamiento esperado
- Solicitudes existentes (sin snapshot): siguen funcionando como antes (fallback a plantilla)
- Solicitudes nuevas: quedan congeladas con la estructura del formulario tal como estaba al crearlas
- Borradores editados: su snapshot se actualiza cada vez que se editan (para reflejar cambios recientes)

### Detalle técnico
- Las columnas son nullable para compatibilidad con datos existentes
- No se requieren cambios en RLS (las columnas viven en `requests` que ya tiene sus políticas)
- El snapshot incluye toda la metadata de campos (label, tipo, opciones, validaciones, dependencias, tabla schema, etc.)

