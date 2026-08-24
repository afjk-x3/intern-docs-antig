-- 20240101000007_fix_approver_queue_rls.sql

-- 1. Allow approvers to see unassigned (pooled) submissions (where current_holder_id IS NULL)
DROP POLICY IF EXISTS "Approvers can read held submissions" ON public.submissions;
CREATE POLICY "Approvers can read held submissions" ON public.submissions 
FOR SELECT USING (
  current_holder_id = auth.uid() OR 
  (current_holder_id IS NULL AND public.get_user_role() IN ('approver', 'admin', 'system_admin')) OR
  public.get_user_role() IN ('admin', 'system_admin')
);

-- 2. Allow approvers to update/claim held or unassigned submissions
DROP POLICY IF EXISTS "Approvers can update held submissions" ON public.submissions;
CREATE POLICY "Approvers can update held submissions" ON public.submissions 
FOR UPDATE USING (
  current_holder_id = auth.uid() OR 
  (current_holder_id IS NULL AND public.get_user_role() IN ('approver', 'admin', 'system_admin')) OR
  public.get_user_role() IN ('admin', 'system_admin')
);

-- 3. Update can_read_submission helper function for version & approval visibility
CREATE OR REPLACE FUNCTION public.can_read_submission(sub_id UUID, user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.submissions 
    WHERE id = sub_id AND (
      intern_id = user_id OR 
      current_holder_id = user_id OR 
      (current_holder_id IS NULL AND public.get_user_role() IN ('approver', 'admin', 'system_admin')) OR
      public.has_approved_submission(sub_id, user_id) OR
      public.get_user_role() IN ('admin', 'system_admin')
    )
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- 4. Allow approvers to insert approvals on held or unassigned submissions
DROP POLICY IF EXISTS "Approvers can insert approvals" ON public.approvals;
CREATE POLICY "Approvers can insert approvals" ON public.approvals FOR INSERT WITH CHECK (
  approver_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.submissions s 
    WHERE s.id = approvals.submission_id AND (
      s.current_holder_id = auth.uid() OR 
      s.current_holder_id IS NULL OR
      public.get_user_role() IN ('admin', 'system_admin')
    )
  )
);
