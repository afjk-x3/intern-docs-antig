-- 20240101000022_track_registration_approval.sql
--
-- Whether a self-registered intern has been admitted to the cohort lived only in
-- auth.users.user_metadata.approved, which meant /admin/users had to read it through
-- supabase.auth.admin.listUsers(). That API returns "Database error finding users" on the
-- production project, so the lookup silently yielded nothing and every account -- including
-- ones still awaiting approval -- rendered as an admitted cohort member with no Approve
-- action. The pending interns were then stuck: blocked at login (which reads the metadata
-- directly and still worked) but invisible to the admin who was supposed to admit them.
--
-- Approval is domain state, so it belongs on the domain row where it can be selected in the
-- same query as the rest of the profile -- no second API call, no pagination, and nothing to
-- silently return empty.
--
-- The metadata key is still written alongside this column (see registerInternWithPassword and
-- approveInternRegistration in lib/data) because login() reads it straight off the session
-- without a database round-trip. Both are set together in the same functions; keep them that
-- way.

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

COMMENT ON COLUMN public.users.approved_at IS
  'When this account was admitted to the cohort. NULL means a self-registration still awaiting admin approval. Admin-invited users are admitted at invite time.';

-- Backfill from the existing source of truth: treat every account as admitted except those
-- whose auth metadata still says approved=false, so accounts currently pending stay pending.
UPDATE public.users u
SET approved_at = u.created_at
WHERE u.approved_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM auth.users a
    WHERE a.id = u.id
      AND a.raw_user_meta_data ->> 'approved' = 'false'
  );
