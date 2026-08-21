-- 20240101000004_phase3_signature_compositing.sql

-- 1. Extend users table with signature columns
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS signature_path TEXT,
ADD COLUMN IF NOT EXISTS signature_updated_at TIMESTAMPTZ;

-- 2. Extend requirements table with signature stamping configuration
ALTER TABLE public.requirements 
ADD COLUMN IF NOT EXISTS signature_config JSONB NOT NULL DEFAULT '{"page": "last", "x": 380, "y": 80, "width": 160, "height": 60}'::jsonb;

-- 3. Create private storage bucket for signatures if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('signatures', 'signatures', false, 2097152, ARRAY['image/png'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = 2097152,
  allowed_mime_types = ARRAY['image/png'];

-- 4. Storage RLS for signatures bucket (INSERT & UPDATE for own user folder)
DROP POLICY IF EXISTS "Users can upload their own signature" ON storage.objects;
CREATE POLICY "Users can upload their own signature"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

DROP POLICY IF EXISTS "Users can update their own signature" ON storage.objects;
CREATE POLICY "Users can update their own signature"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'signatures' AND
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Deny all direct client reads from the signatures bucket (12-backend-security-rules.md §4)
-- The signature image is never served to any client browser directly.
-- The only paths that access it are:
-- (1) Server-side pdf-lib compositing (via service_role / private download)
-- (2) The owner's own settings preview via a short-lived 5-minute signed URL
DROP POLICY IF EXISTS "No direct client reads on signatures bucket" ON storage.objects;
CREATE POLICY "No direct client reads on signatures bucket"
ON storage.objects FOR SELECT TO authenticated
USING (false);
