
-- Add new approval roles to app_role enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'gerencia';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'procesos';
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'integridad_datos';
