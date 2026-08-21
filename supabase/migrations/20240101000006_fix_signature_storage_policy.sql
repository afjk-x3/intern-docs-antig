-- 20240101000006_fix_signature_storage_policy.sql

-- 1. Clean up and recreate storage upload and update policies for the signatures bucket
DROP POLICY IF EXISTS "Users can upload their own signature" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own signature" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload signatures" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update signatures" ON storage.objects;

CREATE POLICY "Authenticated users can upload signatures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'signatures');

CREATE POLICY "Authenticated users can update signatures"
ON storage.objects FOR UPDATE TO authenticated
USING (bucket_id = 'signatures')
WITH CHECK (bucket_id = 'signatures');

-- 2. Ensure signatures bucket exists
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('signatures', 'signatures', false, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png'];
