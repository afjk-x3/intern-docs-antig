-- 20240101000016_intern_groups.sql
--
-- Feature request: let admins divide interns into groups by school and batch,
-- for filtering the completion dashboard, the CSV export, the user list, and
-- the approver queue. Deliberately just two descriptive columns on
-- public.users rather than a separate groups table/entity -- there is no
-- requirement (yet) to manage a fixed catalog of schools/batches, only to tag
-- and filter by them. Visibility-only: no RLS change. Existing row-level
-- policies on public.users already gate who can read/write a row; these are
-- just two more columns on that same row, so approvers/admins continue to see
-- every intern regardless of group, per the PRD's single-cohort MVP boundary.
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS school TEXT,
ADD COLUMN IF NOT EXISTS batch TEXT;

CREATE INDEX IF NOT EXISTS idx_users_school ON public.users(school) WHERE school IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_batch ON public.users(batch) WHERE batch IS NOT NULL;
