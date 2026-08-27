-- Critical fix, found while building the real (Postgres-backed) FR-26 adversarial
-- suite: "Users can update own row" ON public.users FOR UPDATE USING (id = auth.uid())
-- (migration 0) has no WITH CHECK clause. Per Postgres RLS semantics, an UPDATE policy
-- with no explicit WITH CHECK reuses its USING expression for the post-update check too
-- -- and that expression only constrains `id`, never `role`. Verified against a live
-- local instance: any authenticated intern could run
--   UPDATE public.users SET role = 'system_admin' WHERE id = auth.uid();
-- directly against PostgREST and it succeeded, entirely bypassing updateUserRole()'s
-- admin-only check in lib/data/users.ts -- a full, silent privilege escalation with no
-- application code involved. This is exactly the class of bug 05-security.md section 2
-- and R5 exist to prevent ("Every authorization check lives in the database... The UI
-- hiding a button is a usability convenience, never the security boundary").
--
-- enrollSignature() (lib/data/signatures.ts) and updateInternshipDates()
-- (lib/data/users.ts) both legitimately self-update their own users row via the
-- user-context client (signature_path/signature_updated_at, internship_start/end) --
-- so the fix must not touch those columns. It targets `role` only: a BEFORE UPDATE
-- trigger blocks any change to `role` unless the acting session's own role is
-- admin/system_admin. Legitimate admin role changes (updateUserRole in
-- lib/data/users.ts) already write via the service-role admin client, whose session
-- has no `sub` claim -- auth.uid() and therefore get_user_role() resolve to NULL for
-- it, and the trigger treats that as "not a client-side actor" and does not block it.

CREATE OR REPLACE FUNCTION public.prevent_self_role_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role AND public.get_user_role() NOT IN ('admin', 'system_admin') THEN
    RAISE EXCEPTION 'Role changes require administrator privileges'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_self_role_change ON public.users;
CREATE TRIGGER trg_prevent_self_role_change
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_role_change();
