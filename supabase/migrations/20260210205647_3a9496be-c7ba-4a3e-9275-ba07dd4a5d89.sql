
-- Add 'en_espera' status to the enum
ALTER TYPE public.request_status ADD VALUE IF NOT EXISTS 'en_espera';
