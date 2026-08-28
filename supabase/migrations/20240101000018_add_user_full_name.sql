-- 20240101000018_add_user_full_name.sql
--
-- Printed name captured at onboarding (FR-1 onboarding form) and used in place of
-- email on the composited signature block (FR-11). Nullable: existing users predate
-- this column and are not backfilled -- the compositing path already falls back to
-- email when it's unset (see lib/data/submissions.ts, approveSubmissionSigned).

ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS full_name TEXT;
