ALTER TABLE public.request_comments
ADD COLUMN attachments_json jsonb DEFAULT '[]'::jsonb;