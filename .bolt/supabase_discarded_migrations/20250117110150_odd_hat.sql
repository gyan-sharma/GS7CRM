/*
  # Fix opportunities storage and tables

  1. Storage
    - Update storage bucket name to match code
    - Update storage policies
*/

-- Drop existing storage bucket and policies
DROP POLICY IF EXISTS "Allow authenticated to upload opportunity files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to read opportunity files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated to delete opportunity files" ON storage.objects;

DELETE FROM storage.buckets WHERE id = 'opportunity_document_storage';

-- Create storage bucket with correct name
INSERT INTO storage.buckets (id, name, public)
VALUES ('opportunity-documents', 'opportunity-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Create policies with correct bucket name
CREATE POLICY "Allow authenticated to upload opportunity files"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'opportunity-documents'
);

CREATE POLICY "Allow authenticated to read opportunity files"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'opportunity-documents'
);

CREATE POLICY "Allow authenticated to delete opportunity files"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'opportunity-documents'
);