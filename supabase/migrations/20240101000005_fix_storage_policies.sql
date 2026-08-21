-- 20240101000005_fix_storage_policies.sql

-- 1. Clean up and recreate storage upload and read policies for submissions
DROP POLICY IF EXISTS "Interns can insert submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload to submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can upload submissions" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own submissions" ON storage.objects;

CREATE POLICY "Authenticated users can upload to submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

DROP POLICY IF EXISTS "Users can access files for their readable submissions" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read submissions via signed URLs only" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can read submissions via signed URLs" ON storage.objects;

CREATE POLICY "Authenticated users can read submissions via signed URLs"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions');

-- 2. Allow interns to delete orphan submissions if an upload gets interrupted
DROP POLICY IF EXISTS "Interns can delete own orphan submissions" ON public.submissions;
CREATE POLICY "Interns can delete own orphan submissions"
ON public.submissions FOR DELETE TO authenticated
USING (intern_id = auth.uid());
