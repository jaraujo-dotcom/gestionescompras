
-- Add 'file' to the field_type enum
ALTER TYPE public.field_type ADD VALUE IF NOT EXISTS 'file';

-- Create storage bucket for form attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('form-attachments', 'form-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated users to upload files
CREATE POLICY "Authenticated users can upload form attachments"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'form-attachments' 
  AND auth.role() = 'authenticated'
);

-- Allow anyone to view form attachments (public bucket)
CREATE POLICY "Anyone can view form attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'form-attachments');

-- Allow users to delete their own uploads
CREATE POLICY "Users can delete own form attachments"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'form-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);
