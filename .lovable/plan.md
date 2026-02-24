
# Plan: Crear DATABASE.md - Guia del Backend de Gestion de Compras

## Objetivo
Crear un archivo `DATABASE.md` en la raiz del proyecto que documente de forma completa la estructura de la base de datos, roles, politicas de seguridad, flujos de estados y automatizaciones.

## Estructura del Documento

El archivo contendra las siguientes secciones:

### 1. Introduccion
Breve descripcion del sistema "Gestion de Compras" y su proposito.

### 2. Tablas Principales y Relaciones
Documentar las 16 tablas existentes organizadas por dominio:

- **Usuarios**: `profiles`, `user_roles`, `user_groups`, `groups`, `role_definitions`
- **Formularios**: `form_templates`, `form_sections`, `form_fields`
- **Solicitudes**: `requests`, `request_items`, `request_comments`, `request_status_history`
- **Aprobaciones**: `request_approvals`, `request_workflow_steps`
- **Flujos de trabajo**: `workflow_templates`, `workflow_steps`
- **Notificaciones**: `notifications`, `notification_events`, `notification_configs`

Incluir diagrama de relaciones en texto y tablas con columnas clave.

### 3. Sistema de Roles (RBAC)
Explicar los 7 roles del enum `app_role`:
- `solicitante` - Crea solicitudes
- `revisor` - Revisa solicitudes enviadas
- `ejecutor` - Ejecuta solicitudes aprobadas
- `administrador` - Acceso total
- `gerencia` - Aprobacion gerencial (por grupos)
- `procesos` - Aprobacion de procesos
- `integridad_datos` - Aprobacion de integridad de datos

Mencionar la tabla `role_definitions` para configuracion dinamica de etiquetas.

### 4. Politicas de Seguridad (RLS) y Visibilidad
Documentar la funcion `can_view_request()` con una tabla que muestre que ve cada rol. Explicar la logica de visibilidad por grupos para `gerencia` y `solicitante`.

### 5. Flujo y Estados de Solicitudes
Documentar el enum `request_status` con sus 9 estados y el ciclo de vida:
```
borrador -> en_revision -> aprobada -> en_ejecucion -> completada
                        -> devuelta (regresa a borrador)
                        -> rechazada
                        -> anulada
```
Explicar el flujo de aprobacion multi-nivel con pasos paralelos via `request_workflow_steps`.

### 6. Triggers y Funciones Automaticas
Documentar:
- `handle_new_user()` - Creacion automatica de perfil
- `update_updated_at_column()` - Actualizacion de timestamps
- `validate_approval_status()` - Validacion de aprobaciones
- Funciones auxiliares: `has_role()`, `can_view_request()`, `user_in_group()`, `get_user_group_ids()`, `get_profiles_by_ids()`, `get_notifiable_users()`

### 7. Storage
Documentar el bucket `form-attachments` y sus politicas.

## Detalles Tecnicos

- **Archivo a crear**: `DATABASE.md` en la raiz del proyecto
- **Formato**: Markdown con tablas, bloques de codigo SQL, y diagramas ASCII
- **Idioma**: Espanol (consistente con el proyecto)
- **Sin cambios en codigo existente**: Solo se crea un archivo de documentacion
