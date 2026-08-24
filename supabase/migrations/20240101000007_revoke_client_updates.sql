-- 20240101000007_revoke_client_mutations.sql

-- Drop policies that allow direct client updates on submissions
DROP POLICY IF EXISTS "Interns can update own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Approvers can update held submissions" ON public.submissions;

-- Drop policy that allows direct client updates on submission_versions
DROP POLICY IF EXISTS "Users can update versions for readable submissions" ON public.submission_versions;

-- Drop policies that allow direct client inserts (force all writes through server actions)
DROP POLICY IF EXISTS "Interns can insert own submissions" ON public.submissions;
DROP POLICY IF EXISTS "Interns can insert versions for own submissions" ON public.submission_versions;
