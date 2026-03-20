# 📦 Gestión de Compras — Guía del Backend

## 1. Introducción

**Gestión de Compras** es un sistema de solicitudes de compra con flujos de aprobación multi-nivel, control de acceso basado en roles (RBAC) y visibilidad por grupos organizacionales. Permite a los usuarios crear solicitudes usando formularios dinámicos, enviarlas a revisión y seguir un ciclo de aprobación configurable antes de su ejecución.

---

## 2. Tablas Principales y Relaciones

El esquema consta de **17 tablas** organizadas en 7 dominios:

### Diagrama de Relaciones

```
auth.users ──trigger──> profiles
                           │
                    ┌──────┴──────┐
                    ▼              ▼
               user_roles     user_groups
               (app_role)         │
                    │             ▼
                    │          groups
                    │
                    ▼
            role_definitions

form_templates ──> form_sections ──> form_fields
       │     │
       │     ├──> groups (executor_group_id)
       │     └──> form_template_groups ──> groups
       ▼
workflow_templates ──> workflow_steps

requests ──────┬──> request_items
  │            ├──> request_comments (con attachments_json)
  │            ├──> request_status_history
  │            ├──> request_approvals
  │            ├──> request_workflow_steps
  │            ├──> notifications
  │            └──> external_invitations
  │
  ├──> form_templates (template_id)
  ├──> groups (group_id)
  ├── fields_snapshot_json (copia congelada de campos)
  └── sections_snapshot_json (copia congelada de secciones)
```

### 2.1 Dominio: Usuarios

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `profiles` | Perfil público del usuario (creado automáticamente) | `id` (= auth.users.id), `name`, `email` |
| `user_roles` | Asignación de roles a usuarios (muchos a muchos) | `user_id`, `role` (enum `app_role`) |
| `groups` | Grupos organizacionales (ej. departamentos) | `id`, `name`, `description` |
| `user_groups` | Membresía de usuarios en grupos | `user_id`, `group_id` |
| `role_definitions` | Configuración visual/dinámica de roles | `role_key`, `display_name`, `can_approve`, `is_system` |

### 2.2 Dominio: Formularios

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `form_templates` | Plantillas de formulario | `id`, `name`, `is_active`, `default_workflow_id`, `executor_group_id` |
| `form_sections` | Secciones dentro de una plantilla | `template_id`, `name`, `section_order`, `is_collapsible` |
| `form_fields` | Campos de un formulario | `template_id`, `section_id`, `field_key`, `field_type` (enum), `is_required`, `options_json`, `table_schema_json`, `dependency_json`, `validation_json`, `is_external`, `external_mode` |
| `form_template_groups` | Vinculación de plantillas a grupos (muchos a muchos) | `template_id`, `group_id` |

**Tipos de campo** (`field_type` enum): `text`, `number`, `date`, `select`, `boolean`, `table`, `file`

#### Vinculación de Plantillas a Grupos

Las plantillas se vinculan a grupos mediante la tabla `form_template_groups`. Esto controla qué formularios puede ver un usuario al crear una solicitud:

- **Plantilla CON grupos vinculados**: Solo visible para usuarios que pertenezcan a al menos uno de los grupos vinculados.
- **Plantilla SIN grupos vinculados**: Visible para **todos** los usuarios autenticados.

#### Grupo Ejecutor (`executor_group_id`)

Cada plantilla puede tener un **grupo ejecutor** asignado (FK a `groups`). Esto determina qué ejecutores pueden ver, gestionar y recibir notificaciones de las solicitudes creadas con esa plantilla. Los ejecutores que pertenezcan al grupo ejecutor pueden ver las solicitudes de ese tipo incluso si no están en los estados habituales de ejecución.

#### Plantillas sin Flujo de Aprobación

Si una plantilla **no tiene** `default_workflow_id` asignado, las solicitudes creadas con ella **saltan el proceso de aprobación** y pasan directamente al estado `aprobada` al ser enviadas por el solicitante. Esto permite que los ejecutores las vean en su pestaña "Aprobadas" de la bandeja de ejecución y puedan iniciar la ejecución manualmente.

### 2.3 Dominio: Solicitudes

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `requests` | Solicitudes de compra | `id`, `request_number` (secuencial), `template_id`, `title`, `created_by`, `status` (enum), `group_id`, `data_json`, `fields_snapshot_json`, `sections_snapshot_json` |
| `request_items` | Artículos de una solicitud | `request_id`, `nombre_articulo`, `categoria`, `unidad_medida`, `cantidad`, `precio_estimado` |
| `request_comments` | Comentarios de seguimiento con adjuntos | `request_id`, `user_id`, `comment`, `attachments_json` |
| `request_status_history` | Historial de cambios de estado | `request_id`, `from_status`, `to_status`, `changed_by`, `comment` |

#### Snapshots de Formularios (Datos Estáticos)

Al crear o enviar una solicitud, se guarda una **copia congelada** de la estructura del formulario:

- `fields_snapshot_json` (JSONB, nullable): Copia completa de los campos del formulario tal como estaban al momento de crear la solicitud.
- `sections_snapshot_json` (JSONB, nullable): Copia completa de las secciones.

**Comportamiento:**
- **Solicitudes con snapshot**: La visualización y edición usan los campos/secciones del snapshot. Cambios posteriores a la plantilla **no afectan** solicitudes existentes.
- **Solicitudes sin snapshot** (legacy): Se usa la plantilla actual como fallback.
- **Borradores editados**: El snapshot se actualiza al guardar cambios para reflejar la versión más reciente de la plantilla.

#### Adjuntos en Comentarios

Los comentarios (`request_comments`) incluyen un campo `attachments_json` (JSONB) que almacena un array de objetos con la metadata de archivos adjuntos:

```json
[
  {
    "name": "documento.pdf",
    "path": "comment-attachments/{request_id}/{uuid}-documento.pdf",
    "size": 102400,
    "type": "application/pdf"
  }
]
```

Los archivos se almacenan en el bucket `form-attachments` bajo el prefijo `comment-attachments/`.

### 2.4 Dominio: Invitaciones Externas

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `external_invitations` | Invitaciones a terceros para completar campos externos | `request_id`, `guest_email`, `guest_name`, `token`, `status` (`pending`/`completed`/`expired`), `expires_at`, `completed_at`, `created_by` |

Los campos de formulario con `is_external = true` o `external_mode = 'editable'` pueden ser completados por terceros invitados a través de un enlace público con token. Los campos con `external_mode = 'readonly'` son visibles pero no editables por el tercero.

### 2.5 Dominio: Aprobaciones

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `request_approvals` | Decisiones de aprobación por rol | `request_id`, `role`, `approved_by`, `status` (`pendiente`/`aprobada`/`rechazada`/`devuelta`), `comment` |
| `request_workflow_steps` | Pasos del workflow instanciados por solicitud | `request_id`, `step_order`, `role_name`, `label`, `status` (`pending`/`approved`/`rejected`/`skipped`), `approved_by` |

### 2.6 Dominio: Flujos de Trabajo

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `workflow_templates` | Plantillas de flujo reutilizables | `id`, `name`, `description` |
| `workflow_steps` | Pasos definidos en una plantilla | `workflow_id`, `step_order`, `role_name`, `label` |

### 2.7 Dominio: Notificaciones

| Tabla | Descripción | Columnas Clave |
|-------|-------------|----------------|
| `notifications` | Notificaciones in-app por usuario | `user_id`, `title`, `message`, `type` (`status_change`, `new_comment`, `assignment`, `external_data`), `request_id`, `is_read` |

Las notificaciones se crean mediante la función `sendNotification()` del frontend, que llama a la edge function `send-notification`. Los destinatarios se determinan con la función SQL `get_notifiable_users()`.

---

## 3. Sistema de Roles (RBAC)

Los roles se definen con el enum `app_role` y se asignan en la tabla `user_roles`. Un usuario puede tener **múltiples roles**.

| Rol | Clave | Descripción de Negocio |
|-----|-------|------------------------|
| Solicitante | `solicitante` | Crea y envía solicitudes de compra. **Solo ve sus propias solicitudes**. |
| Revisor | `revisor` | Revisa todas las solicitudes enviadas (no borradores). Puede devolver o avanzar estados. |
| Gerencia | `gerencia` | Aprueba solicitudes **solo de sus grupos**. Primer nivel de aprobación. |
| Procesos | `procesos` | Aprueba solicitudes a nivel de procesos. Acceso global (no borradores). |
| Integridad de Datos | `integridad_datos` | Aprueba solicitudes verificando integridad. Acceso global (no borradores). |
| Ejecutor | `ejecutor` | Ejecuta solicitudes aprobadas. Ve solicitudes en estado `aprobada` en adelante. **Si pertenece al grupo ejecutor** de una plantilla, puede ver todas las solicitudes de ese tipo (excepto borradores). |
| Administrador | `administrador` | Acceso total a todo el sistema. Puede actuar en nombre de cualquier rol de aprobación. |

> **Nota sobre Solicitante**: El rol solicitante **NO puede ver solicitudes de otros usuarios** de su grupo. Solo ve las solicitudes que él mismo creó. Tampoco se le muestra el filtro de grupo en la lista de solicitudes.

### Tabla `role_definitions`

Permite configurar dinámicamente las **etiquetas visibles** y el flag `can_approve` de cada rol desde el panel de administración, sin modificar el enum en la base de datos.

---

## 4. Políticas de Seguridad (RLS) y Visibilidad

Todas las tablas tienen **Row Level Security (RLS)** habilitado. La visibilidad de solicitudes se centraliza en la función `can_view_request()`.

### Función `can_view_request(_user_id, _request_id)`

```sql
-- Lógica simplificada:
SELECT EXISTS (
  SELECT 1 FROM requests r
  LEFT JOIN form_templates ft ON ft.id = r.template_id
  WHERE r.id = _request_id AND (
    r.created_by = _user_id                                    -- Creador siempre ve la suya
    OR (r.group_id IS NOT NULL
        AND user_in_group(_user_id, r.group_id)
        AND has_role(_user_id, 'gerencia'))                    -- Gerencia: solo su grupo
    OR (has_role('revisor') AND status NOT IN ('borrador'))     -- Revisor: todo menos borradores
    OR (has_role('procesos') AND status NOT IN ('borrador'))    -- Procesos: todo menos borradores
    OR (has_role('integridad_datos') AND status NOT IN ('borrador'))  -- Integridad: todo menos borradores
    OR (has_role('ejecutor') AND (
        status IN ('aprobada','en_ejecucion','en_espera','completada','anulada')
        OR (ft.executor_group_id IS NOT NULL                   -- Ejecutor del grupo ejecutor:
            AND user_in_group(_user_id, ft.executor_group_id)  -- ve todo excepto borradores
            AND status != 'borrador')
    ))
    OR has_role('administrador')                                -- Admin: todo
  )
);
```

### Matriz de Visibilidad por Rol

| Rol | Borradores | En Revisión | Aprobada | En Ejecución | Completada | Rechazada | Devuelta | Anulada |
|-----|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Solicitante** (propias) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Gerencia** (su grupo) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Revisor** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Procesos** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Integridad Datos** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Ejecutor** (sin grupo ejecutor) | ❌ | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ |
| **Ejecutor** (en grupo ejecutor de la plantilla) | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Administrador** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

> **Nota sobre Gerencia**: Su visibilidad depende de pertenecer al mismo `group_id` de la solicitud via `user_groups`. No tiene acceso global.
>
> **Nota sobre Ejecutor con grupo ejecutor**: Si la plantilla de la solicitud tiene un `executor_group_id` y el ejecutor pertenece a ese grupo, puede ver la solicitud en cualquier estado excepto `borrador`.

### Funciones auxiliares de seguridad

| Función | Tipo | Propósito |
|---------|------|-----------|
| `has_role(_user_id, _role)` | `SECURITY DEFINER` | Verifica si un usuario tiene un rol específico. Evita recursión en RLS. |
| `user_in_group(_user_id, _group_id)` | `SECURITY DEFINER` | Verifica membresía en un grupo. |
| `get_user_group_ids(_user_id)` | `SECURITY DEFINER` | Retorna array de IDs de grupos del usuario. |
| `get_user_roles(_user_id)` | `SECURITY DEFINER` | Retorna array de roles del usuario. |
| `get_profiles_by_ids(_ids)` | `SECURITY DEFINER` | Resolución segura de nombres (solo perfiles accesibles). |
| `get_notifiable_users(_request_id, _exclude)` | `SECURITY DEFINER` | Destinatarios de notificaciones por solicitud. |

---

## 5. Flujo y Estados de Solicitudes

### Enum `request_status`

| Estado | Etiqueta UI | Descripción |
|--------|-------------|-------------|
| `borrador` | Borrador | Solicitud en edición, no visible para aprobadores. |
| `en_revision` | Pendiente de Aprobación | Enviada y esperando aprobaciones del workflow. |
| `devuelta` | Devuelta | Rechazada parcialmente, regresa al solicitante para corrección. |
| `aprobada` | Aprobada | Todos los pasos de aprobación completados. |
| `en_ejecucion` | En Ejecución | El ejecutor está procesando la compra. |
| `en_espera` | En Espera | Ejecución pausada temporalmente. |
| `esperando_tercero` | Esperando Tercero | Solicitud en espera de datos de un tercero externo invitado. |
| `completada` | Completada | Compra finalizada. |
| `rechazada` | Rechazada | Rechazada definitivamente. |
| `anulada` | Anulada | Cancelada después de aprobación. |

### Diagrama de Ciclo de Vida

```
┌─────────┐    enviar    ┌─────────────┐
│ borrador ├─────────────►│ en_revision │
└────▲─────┘              └──────┬──────┘
     │                           │
     │ corregir          ┌───────┼───────┐
     │                   │       │       │
     │              aprobar  devolver  rechazar
     │                   │       │       │
     │                   ▼       │       ▼
     │             ┌──────────┐  │  ┌───────────┐
     │             │ aprobada │  │  │ rechazada │
     │             └────┬─────┘  │  └───────────┘
     │                  │        │
     └──────────────────┘        │
                  │              │
            ejecutar             │
                  │              │
                  ▼              │
          ┌──────────────┐       │
          │ en_ejecucion │◄──────┘ (devuelta → borrador)
          └──────┬───────┘
                 │
          ┌──────┼──────┐
          │      │      │
       pausar  completar anular
          │      │      │
          ▼      ▼      ▼
    ┌──────────┐ ┌───────────┐ ┌─────────┐
    │ en_espera│ │completada │ │ anulada │
    └──────────┘ └───────────┘ └─────────┘
```

### Flujo de Aprobación Multi-Nivel

1. Al enviar una solicitud, el sistema verifica si la plantilla tiene un workflow asignado (`default_workflow_id`):
   - **Con workflow**: La solicitud pasa a `en_revision` y se instancian los pasos en `request_workflow_steps`.
   - **Sin workflow**: La solicitud pasa **directamente a `aprobada`**, saltando todo el proceso de aprobación.
2. Cada paso tiene un `role_name` y `step_order`. Los pasos con el **mismo `step_order`** se ejecutan en **paralelo**.
3. Los aprobadores con el rol correspondiente pueden aprobar/rechazar/devolver su paso.
4. Las decisiones se registran en `request_approvals` (histórico) y se actualizan en `request_workflow_steps` (estado actual).
5. Cuando **todos los pasos** están en `approved`, la solicitud avanza a `aprobada`.
6. Si cualquier paso es `rejected`, la solicitud pasa a `rechazada`.
7. Si un paso devuelve, la solicitud regresa a `devuelta` (y luego a `borrador` para corrección).

### Validación de Aprobaciones (Trigger)

```sql
-- validate_approval_status(): se ejecuta BEFORE INSERT/UPDATE en request_approvals
-- Valida que:
--   status ∈ ('pendiente', 'aprobada', 'rechazada', 'devuelta')
--   role ∈ ('gerencia', 'procesos', 'integridad_datos')
```

---

## 6. Triggers y Funciones Automáticas

### Triggers

| Trigger | Tabla | Evento | Función |
|---------|-------|--------|---------|
| `on_auth_user_created` | `auth.users` | AFTER INSERT | `handle_new_user()` |
| `validate_approval` | `request_approvals` | BEFORE INSERT/UPDATE | `validate_approval_status()` |
| `validate_invitation` | `external_invitations` | BEFORE INSERT/UPDATE | `validate_invitation_status()` |
| `update_*_updated_at` | Varias tablas | BEFORE UPDATE | `update_updated_at_column()` |

### Funciones

#### `handle_new_user()` — Creación automática de perfil
```sql
-- Trigger: se ejecuta al crear un usuario en auth.users
-- Acción: Inserta en profiles con id, name (del metadata o email), email
INSERT INTO profiles (id, name, email)
VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)), NEW.email);
```

#### `update_updated_at_column()` — Timestamps automáticos
```sql
-- Trigger: BEFORE UPDATE en tablas con columna updated_at
-- Acción: Establece NEW.updated_at = now()
```

#### `validate_approval_status()` — Validación de aprobaciones
Verifica que solo se usen estados y roles válidos al insertar/actualizar en `request_approvals`.

#### `validate_invitation_status()` — Validación de invitaciones
Verifica que el status de invitaciones sea uno de: `pending`, `completed`, `expired`.

#### `get_profiles_by_ids(_ids uuid[])` — Resolución segura de nombres
Retorna `id` y `name` de perfiles, pero **solo** si el llamante tiene derecho a ver esos perfiles (porque compartió request, comentarios, o es admin). Previene enumeración de usuarios.

#### `get_notifiable_users(_request_id, _exclude_user_id)` — Destinatarios de notificaciones
Retorna todos los usuarios que deben ser notificados sobre una solicitud: el creador + usuarios con roles de aprobación/ejecución/administración. Usado por la edge function `send-notification`.

#### `get_user_roles(_user_id)` — Array de roles
```sql
-- Retorna: app_role[] con todos los roles del usuario
SELECT ARRAY_AGG(role) FROM user_roles WHERE user_id = _user_id;
```

---

## 7. Storage

### Bucket: `form-attachments`

| Propiedad | Valor |
|-----------|-------|
| Nombre | `form-attachments` |
| Público | No (requiere autenticación) |
| Uso | Archivos adjuntos en campos tipo `file` de formularios dinámicos y adjuntos de comentarios |

**Estructura de rutas:**
- Campos de formulario: `{request_id}/{uuid}-{filename}`
- Adjuntos de comentarios: `comment-attachments/{request_id}/{uuid}-{filename}`

Los archivos se referencian en el `data_json` de la solicitud (para campos file) o en `attachments_json` de comentarios.

---

## 8. Edge Functions

| Función | Propósito |
|---------|-----------|
| `send-notification` | Envía notificaciones por email (via webhook N8N) e in-app. Usa `get_notifiable_users()` para determinar destinatarios. |
| `external-form` | Gestiona formularios para terceros externos. GET: retorna campos y datos existentes con flags `_readonly`. POST: valida token, filtra solo campos con `external_mode = 'editable'`, actualiza `data_json` de la solicitud, marca invitación como completada y notifica al creador. |

### 8.1 Reglas de Entrega de Notificaciones (Filtrado Inteligente)

La edge function `send-notification` filtra los destinatarios según el **contexto de la solicitud**, no solo por rol:

| Rol | Recibe notificación si... |
|-----|--------------------------|
| **Gerencia** | Pertenece al `group_id` de la solicitud |
| **Revisor** | Pertenece al `group_id` de la solicitud |
| **Ejecutor** | Pertenece al `executor_group_id` de la plantilla asociada |
| **Procesos** | Es aprobador en el flujo de trabajo (`request_workflow_steps`) de esa solicitud, O pertenece al `executor_group_id` |
| **Integridad de Datos** | Es aprobador en el flujo de trabajo de esa solicitud, O pertenece al `executor_group_id` |
| **Administrador** | Siempre (sin filtro de grupo) |
| **Creador** | Siempre recibe notificaciones de su propia solicitud |

Esto evita que usuarios reciban notificaciones de solicitudes que no les corresponden por grupo o contexto de aprobación.

---

## 9. Enums de la Base de Datos

```sql
-- Roles de la aplicación
CREATE TYPE app_role AS ENUM (
  'solicitante', 'revisor', 'ejecutor', 'administrador',
  'gerencia', 'procesos', 'integridad_datos'
);

-- Estados de solicitud
CREATE TYPE request_status AS ENUM (
  'borrador', 'en_revision', 'devuelta', 'aprobada',
  'en_ejecucion', 'en_espera', 'esperando_tercero',
  'completada', 'rechazada', 'anulada'
);

-- Tipos de campo de formulario
CREATE TYPE field_type AS ENUM (
  'text', 'number', 'date', 'select', 'boolean', 'table', 'file'
);
```

---

## 10. Secuencias

| Secuencia | Uso |
|-----------|-----|
| `request_number_seq` | Genera números consecutivos para `requests.request_number` |

---

## 11. Secrets Configurados

| Secret | Uso |
|--------|-----|
| `N8N_EMAIL_WEBHOOK_URL` | URL del webhook de N8N para envío de emails |
| `LOVABLE_API_KEY` | API key para funcionalidades de IA de Lovable |
| `SUPABASE_URL` | URL del proyecto Supabase |
| `SUPABASE_ANON_KEY` | Clave anónima de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave de servicio de Supabase (uso en edge functions) |

---

*Última actualización: Marzo 2026*
