

# Plan: Portal de Invitados Externos para Precarga de Solicitudes

## Resumen

Permitir que un usuario interno genere un enlace temporal (token) para que un tercero (ej. proveedor) complete campos específicos de una solicitud en borrador, sin necesidad de cuenta en el sistema. El tercero ve una página aislada con solo los campos marcados como "visibles para externos".

## Modelo de Datos

### Nueva tabla: `external_invitations`

| Columna | Tipo | Descripción |
|---|---|---|
| id | uuid PK | |
| request_id | uuid FK → requests | Solicitud asociada |
| token | text UNIQUE | Hash seguro para la URL |
| status | text | `pending`, `completed`, `expired` |
| expires_at | timestamptz | Caducidad configurable |
| guest_name | text | Nombre del invitado (opcional, para referencia) |
| guest_email | text | Email del invitado (opcional) |
| created_by | uuid | Usuario interno que generó el enlace |
| created_at | timestamptz | |
| completed_at | timestamptz | Fecha en que el tercero envió los datos |

RLS: Solo el creador y admins pueden leer/crear invitaciones. Sin acceso público (el acceso del tercero será via edge function).

### Nuevo campo en `form_fields`: `is_external`

Un booleano (`default false`) que indica si el campo es visible/editable por invitados externos. Se configura en el FieldEditor del admin.

### Nuevo estado de solicitud: `esperando_tercero`

Agregar al enum `request_status` el valor `esperando_tercero` para indicar que la solicitud está pendiente de datos externos.

## Edge Function: `external-form`

Una función pública (sin JWT) que maneja dos operaciones:

**GET (validar token):** Recibe el token, valida que no esté expirado ni completado. Devuelve SOLO los campos marcados como `is_external = true` del formulario, junto con los datos parciales ya precargados por el usuario interno. Nunca envía campos internos.

**POST (enviar datos):** Recibe el token y los valores. Valida el token, valida los campos, actualiza `data_json` de la solicitud (merge), marca la invitación como `completed`, cambia el estado de la solicitud de `esperando_tercero` a `borrador` (para que el interno complete), y envía notificación al creador.

## Cambios en el Frontend

### 1. FieldEditor: nuevo toggle "Visible para externos"

En `src/components/admin/FieldEditor.tsx`, agregar un `Switch` con label "Externo" junto al switch de "Requerido". Controla el nuevo campo `is_external` en `FieldDraft`.

### 2. Nueva página: `/external/:token` (Guest Portal)

Ruta pública fuera del `AppLayout`. Página limpia sin sidebar ni navegación. Flujo:
- Valida el token via edge function
- Si válido: muestra formulario con solo campos `is_external`
- Si expirado/completado: muestra mensaje de error
- Al enviar: POST a edge function, muestra confirmación

Usa el mismo componente `DynamicForm` pero filtrando solo campos externos.

### 3. En `RequestDetail`: botón "Invitar Externo"

Solo visible cuando la solicitud está en `borrador`. Abre un dialog para:
- Configurar nombre/email del invitado (opcional)
- Configurar horas de expiración (default 72h)
- Generar el enlace y mostrarlo para copiar

### 4. Indicador visual de datos externos

En la vista de solicitud, los campos llenados por el tercero se muestran con un badge o borde que indica "Completado por externo".

## Flujo Completo

```text
1. Admin marca campos como "Externo" en el editor de plantilla
2. Usuario interno crea solicitud (borrador), llena sus campos
3. Hace clic en "Invitar Externo" → genera enlace con token
4. Solicitud pasa a estado "esperando_tercero"
5. Tercero abre enlace → ve solo campos externos → llena → envía
6. Solicitud vuelve a "borrador", usuario interno recibe notificación
7. Usuario interno revisa, completa campos faltantes, envía a revisión
```

## Seguridad

- Tokens generados con `crypto.randomUUID()` + hash, caducidad configurable
- Edge function usa service role para leer/escribir, pero SOLO expone campos `is_external`
- El token se invalida tras uso (status = completed)
- Rate limiting implícito: un token = un uso
- No se expone estructura interna del formulario al tercero

## Archivos a Crear/Modificar

| Archivo | Acción |
|---|---|
| Migración SQL | Crear tabla `external_invitations`, agregar `is_external` a `form_fields`, agregar `esperando_tercero` al enum |
| `supabase/functions/external-form/index.ts` | Nueva edge function pública |
| `src/pages/external/GuestForm.tsx` | Nueva página del portal de invitados |
| `src/components/admin/FieldEditor.tsx` | Agregar toggle "Externo" |
| `src/components/requests/ExternalInviteDialog.tsx` | Nuevo dialog para generar enlace |
| `src/pages/requests/RequestDetail.tsx` | Agregar botón "Invitar Externo" |
| `src/types/database.ts` | Agregar tipo `ExternalInvitation`, actualizar `RequestStatus` |
| `src/App.tsx` | Agregar ruta `/external/:token` |
| `supabase/config.toml` | Configurar `verify_jwt = false` para la nueva función |
| `DATABASE.md` | Documentar nueva funcionalidad |

