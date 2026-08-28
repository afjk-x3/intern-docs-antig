-- 20240101000015_reassert_submissions_upload_policy.sql

DROP POLICY IF EXISTS "Authenticated users can upload to submissions" ON storage.objects;
CREATE POLICY "Authenticated users can upload to submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

-- Ensure the bucket itself exists with the expected config (idempotent; matches 20240101000002).
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('submissions', 'submissions', false, 20971520, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;
