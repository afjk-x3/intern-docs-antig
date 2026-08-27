-- 20240101000011_fix_submissions_storage_and_delete_policy.sql
--
-- FR-25 / FR-26 scenario 6 (adversarial suite): the "submissions" bucket SELECT
-- policy added in 20240101000002 (and re-created in 20240101000005) was named
-- "read via signed URLs only" but its USING clause had no ownership or holder
-- scoping (`bucket_id = 'submissions'`), so any authenticated user could read
-- any object in the bucket directly, bypassing the 5-minute signed URL rule
-- entirely. All legitimate download paths go through
-- lib/data/submissions.ts:getSubmissionSignedDownloadUrl, which already falls
-- back to the service-role (admin) client for both `.download()` and
-- `.createSignedUrl()` when the user-context client is denied, so locking this
-- down does not break downloads. This mirrors the correct `USING (false)` fix
-- already applied to the "signatures" bucket in 20240101000004.
DROP POLICY IF EXISTS "Authenticated users can read submissions via signed URLs" ON storage.objects;
CREATE POLICY "No direct client reads of submissions bucket"
ON storage.objects FOR SELECT TO authenticated
USING (false);

-- FR-14 / FR-23: an approved submission's approval record must be immutable
-- and survive at least 3 years; no client role may ever remove a submission
-- row. 20240101000005 added a DELETE policy named "delete own orphan
-- submissions" but its USING clause had no state filter at all
-- (`intern_id = auth.uid()`), so an intern could delete a submission in ANY
-- state -- including APPROVED -- via a direct REST call, cascading away its
-- submission_versions and approvals rows. There is no legitimate client-side
-- use case for deleting a submission row; only the retention job (via the
-- service-role client) may ever remove one, and it never deletes the row,
-- only the file bytes referenced by it.
DROP POLICY IF EXISTS "Interns can delete own orphan submissions" ON public.submissions;
