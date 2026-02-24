

# Plan: Notificaciones Inteligentes por Grupo y Rol

## Problema Actual

Hoy, el sistema de notificaciones toma TODOS los usuarios que tengan los roles definidos en `target_roles` y les envía la notificación, sin importar si tienen relación con la solicitud específica. Esto genera ruido: un gerente recibe notificaciones de solicitudes de grupos que no le corresponden, un ejecutor recibe de plantillas que no gestiona, etc.

## Nuevas Reglas de Notificación

| Rol | Recibe notificación si... |
|---|---|
| **Gerencia** | Pertenece al `group_id` de la solicitud |
| **Revisor** | Pertenece al `group_id` de la solicitud |
| **Ejecutor** | Pertenece al `executor_group_id` de la plantilla asociada |
| **Procesos** | Es aprobador en el flujo de trabajo de esa solicitud, O es ejecutor (pertenece al executor_group) |
| **Integridad de Datos** | Es aprobador en el flujo de trabajo de esa solicitud, O es ejecutor (pertenece al executor_group) |
| **Administrador** | Siempre |
| **Creador** | Segun configuracion (`include_creator`) |

## Cambios Necesarios

### 1. Modificar la Edge Function `send-notification/index.ts`

Reemplazar la seccion de "Get recipients based on config" (lineas 190-213) con logica inteligente:

**a) Obtener datos adicionales de la solicitud:**
- `group_id` de la solicitud (agregar al SELECT existente en linea 124)
- `executor_group_id` de la plantilla (agregar al SELECT del join con `form_templates`)

**b) Para cada rol en `target_roles`, filtrar por contexto:**

```text
Para "gerencia" y "revisor":
  -> Obtener user_ids de user_groups WHERE group_id = request.group_id
  -> Intersectar con usuarios que tengan ese rol

Para "ejecutor":
  -> Si la plantilla tiene executor_group_id:
     Obtener user_ids de user_groups WHERE group_id = template.executor_group_id
     Intersectar con usuarios que tengan rol ejecutor
  -> Si no tiene executor_group_id: no notificar ejecutores

Para "procesos" e "integridad_datos":
  -> Verificar si el rol aparece en request_workflow_steps de esa solicitud
  -> Si aparece: incluir usuarios con ese rol
  -> Ademas, si pertenecen al executor_group_id: incluirlos tambien

Para "administrador":
  -> Incluir todos los usuarios con rol administrador (sin filtro)
```

**c) Unificar los user_ids resultantes** en un Set, agregar creador si aplica, y continuar con el flujo existente.

### Detalle Tecnico de la Implementacion

Se reescribira la seccion de recipientes en la edge function con esta logica:

1. Ampliar el query de request para incluir `group_id` y `form_templates(name, executor_group_id)`
2. Consultar `request_workflow_steps` para saber que roles son aprobadores en esa solicitud
3. Para cada rol en `target_roles`:
   - **gerencia/revisor**: query `user_roles` JOIN `user_groups` filtrando por `request.group_id`
   - **ejecutor**: query `user_roles` JOIN `user_groups` filtrando por `template.executor_group_id`
   - **procesos/integridad_datos**: si el rol esta en los workflow steps, incluir todos con ese rol; ademas si pertenecen al executor group
   - **administrador**: todos
4. Mantener la logica de `include_creator` y el resto del flujo sin cambios

### Archivos a Modificar

- `supabase/functions/send-notification/index.ts` - Logica de seleccion de destinatarios
- `DATABASE.md` - Documentar las nuevas reglas de notificacion

No se requieren cambios de base de datos (migraciones), ya que toda la informacion necesaria (`group_id`, `executor_group_id`, `request_workflow_steps`) ya existe en las tablas.

