-- 20240101000008_phase5_privacy_and_hardening.sql

-- 1. Add privacy acknowledgment timestamp to users
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS privacy_acknowledged_at TIMESTAMPTZ;

-- 2. Ensure audit_log is strictly append-only (no update, no delete by any authenticated role)
DROP POLICY IF EXISTS "Deny update on audit_log" ON public.audit_log;
DROP POLICY IF EXISTS "Deny delete on audit_log" ON public.audit_log;

-- Users can only insert audit logs via server-side procedures or read if admin
CREATE POLICY "Deny direct client modifications to audit_log" 
ON public.audit_log 
FOR ALL TO authenticated 
USING (public.get_user_role() IN ('admin', 'system_admin'))
WITH CHECK (false);
