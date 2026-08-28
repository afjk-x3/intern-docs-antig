-- 20240101000014_expand_signature_formats.sql
--
-- PNG. Approvers/admins with a JPG scan of their signature had no way to enroll
-- it. lib/data/signatures.ts and SignaturePad.tsx now accept and correctly
-- store/composite both PNG and JPEG signatures; this migration lifts the
-- matching bucket-level restriction, which Supabase Storage enforces
-- independently of the RLS policies on storage.objects.
UPDATE storage.buckets
SET allowed_mime_types = ARRAY['image/png', 'image/jpeg']
WHERE id = 'signatures';
