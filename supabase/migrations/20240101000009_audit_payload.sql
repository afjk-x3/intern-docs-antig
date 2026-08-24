-- 20240101000009_audit_payload.sql
-- Fixes missing payload column for audit_log which dropped metadata silently

ALTER TABLE public.audit_log
  ADD COLUMN IF NOT EXISTS payload JSONB;

COMMENT ON COLUMN public.audit_log.payload IS
  'Optional JSON payload for additional event context (e.g. export filters, deletion hashes).';
