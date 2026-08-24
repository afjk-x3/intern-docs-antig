-- 20240101000010_fix_approvers_read_policy.sql

-- Allow approvers to view other approvers and admins for reassignment dropdowns (FR-15)
DROP POLICY IF EXISTS "Approvers can read other approvers" ON public.users;
CREATE POLICY "Approvers can read other approvers" ON public.users 
FOR SELECT USING (
  public.get_user_role() = 'approver' AND role IN ('approver', 'admin', 'system_admin')
);
