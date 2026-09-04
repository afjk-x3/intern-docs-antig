-- 20240101000021_track_signed_output_deletion.sql
--
-- FR-22 requires the retention job to delete "the stored files -- submitted versions and
-- signed outputs". Until now lib/jobs/retention-sweep.ts deleted only the single active
-- submission_version, so every signed PDF (approvals.signed_pdf_url) and every superseded
-- version kept its bytes in the `submissions` bucket indefinitely, even though the
-- submission was marked PURGED and audit-logged as RETENTION_PURGE_EXECUTED.
--
-- This column is the per-approval counterpart of submission_versions.deleted_at
-- (migration 20240101000010). It gives the sweep an idempotency marker so it does not
-- re-attempt removal of already-deleted signed outputs on every daily run, and it gives
-- FR-23 the "deletion timestamp" it requires an administrator to still see after the
-- document itself is gone.
--
-- It does not weaken FR-23's immutability guarantee: the attestation fields (approver_id,
-- step, file_hash, created_at) are untouched, and no client role has an UPDATE policy on
-- public.approvals -- only the service-role retention job writes this column.

ALTER TABLE public.approvals
ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

COMMENT ON COLUMN public.approvals.deleted_at IS
  'When the signed PDF bytes at signed_pdf_url were removed from storage by the retention job (FR-22). The approval record itself is retained for 3 years (FR-23).';
