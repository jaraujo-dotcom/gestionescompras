
-- Make the bucket private
UPDATE storage.buckets SET public = false WHERE id = 'form-attachments';

-- Drop the public access policy
DROP POLICY IF EXISTS "Anyone can view form attachments" ON storage.objects;

-- Authenticated users can view files in form-attachments
CREATE POLICY "Authenticated can view form attachments"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'form-attachments');
