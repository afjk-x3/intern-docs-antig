-- 20240101000001_phase4_retention_audit.sql

-- Add deleted_at to track when file bytes are physically removed by retention job
ALTER TABLE public.submission_versions
ADD COLUMN deleted_at TIMESTAMPTZ;

-- Re-affirm append-only grants for audit_log to ensure safety (this is already in initial schema but re-asserted here per Phase 4 requirements)
REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon, public;

-- For post-deletion admin view, admins should be able to see submission versions even if deleted
-- The initial schema policy "Users can read versions for readable submissions" already covers this.
