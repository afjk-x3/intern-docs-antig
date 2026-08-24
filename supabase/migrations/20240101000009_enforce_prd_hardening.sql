-- 20240101000009_enforce_prd_hardening.sql

-- 1. Add routing_snapshot column to submissions for in-flight template stability (FR-8)
ALTER TABLE public.submissions 
ADD COLUMN IF NOT EXISTS routing_snapshot JSONB;

-- 2. State Machine Enforcement: Deny unconstrained client UPDATE on public.submissions
-- State transitions must strictly go through the Server Action workflow API (FR-13)
DROP POLICY IF EXISTS "Interns can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Approvers can update held submissions" ON public.submissions;
DROP POLICY IF EXISTS "Admins/System Admins can update any submission" ON public.submissions;

-- 3. Freeze Rule Enforcement: Make public.submission_versions strictly immutable (FR-14)
-- File versions and SHA-256 hashes can never be altered or updated by any client role
DROP POLICY IF EXISTS "Users can update versions for readable submissions" ON public.submission_versions;

-- 4. Audit Log Protection: Ensure audit_log is append-only (FR-24)
DROP POLICY IF EXISTS "Deny direct client modifications to audit_log" ON public.audit_log;
CREATE POLICY "Deny direct client modifications to audit_log" 
ON public.audit_log 
FOR ALL TO authenticated 
USING (public.get_user_role() IN ('admin', 'system_admin'))
WITH CHECK (false);
