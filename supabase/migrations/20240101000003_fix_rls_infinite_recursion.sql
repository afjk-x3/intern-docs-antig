-- 20240101000003_fix_rls_infinite_recursion.sql

-- 1. Helper function: Check if an approver has previously approved a submission
-- Uses SECURITY DEFINER to bypass RLS recursion on the approvals table
CREATE OR REPLACE FUNCTION public.has_approved_submission(sub_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.approvals 
    WHERE submission_id = sub_id AND approver_id = user_id
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 2. Helper function: Check if a user has permission to read a submission
-- Uses SECURITY DEFINER to bypass RLS recursion when reading child tables (versions/approvals)
CREATE OR REPLACE FUNCTION public.can_read_submission(sub_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions 
    WHERE id = sub_id AND (
      intern_id = user_id OR 
      current_holder_id = user_id OR 
      public.has_approved_submission(sub_id, user_id) OR
      public.get_user_role() IN ('admin', 'system_admin')
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 3. Replace circular policy on `submissions`
DROP POLICY IF EXISTS "Approvers can read previously assigned submissions" ON public.submissions;
CREATE POLICY "Approvers can read previously assigned submissions" ON public.submissions 
FOR SELECT USING (
  public.has_approved_submission(id, auth.uid())
);

-- 4. Replace circular policy on `submission_versions`
DROP POLICY IF EXISTS "Users can read versions for readable submissions" ON public.submission_versions;
CREATE POLICY "Users can read versions for readable submissions" ON public.submission_versions 
FOR SELECT USING (
  public.can_read_submission(submission_id, auth.uid())
);

-- 5. Replace circular policy on `approvals`
DROP POLICY IF EXISTS "Users can read approvals for readable submissions" ON public.approvals;
CREATE POLICY "Users can read approvals for readable submissions" ON public.approvals 
FOR SELECT USING (
  approver_id = auth.uid() OR public.can_read_submission(submission_id, auth.uid())
);
