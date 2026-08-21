-- 00000000000000_initial_schema.sql

CREATE TYPE public.user_role AS ENUM ('intern', 'approver', 'admin', 'system_admin');
CREATE TYPE public.submission_state AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'RETURNED', 'APPROVED', 'CANCELLED', 'EXPIRED', 'PURGED');
CREATE TYPE public.due_date_type AS ENUM ('fixed', 'relative');

-- 1. Users
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  role public.user_role NOT NULL,
  internship_start DATE,
  internship_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Helper to get role without recursion
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS public.user_role AS $$
  SELECT role FROM public.users WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- Users RLS
CREATE POLICY "Users can read own row" ON public.users FOR SELECT USING (id = auth.uid());
CREATE POLICY "Admins can read all users" ON public.users FOR SELECT USING (public.get_user_role() IN ('admin', 'system_admin'));
CREATE POLICY "Approvers can read interns" ON public.users FOR SELECT USING (public.get_user_role() = 'approver' AND role = 'intern');
CREATE POLICY "Users can update own row" ON public.users FOR UPDATE USING (id = auth.uid());
CREATE POLICY "Admins can update all users" ON public.users FOR UPDATE USING (public.get_user_role() IN ('admin', 'system_admin'));
CREATE POLICY "Admins can insert users" ON public.users FOR INSERT WITH CHECK (public.get_user_role() IN ('admin', 'system_admin'));

-- 2. Routing Templates
CREATE TABLE public.routing_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  sla_days INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.routing_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read routing templates" ON public.routing_templates FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage routing templates" ON public.routing_templates FOR ALL USING (public.get_user_role() IN ('admin', 'system_admin'));

-- 3. Requirements
CREATE TABLE public.requirements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  accepted_types TEXT[] NOT NULL,
  max_size_mb INTEGER NOT NULL DEFAULT 20,
  due_date_type public.due_date_type NOT NULL,
  due_date_value TEXT,
  template_url TEXT,
  routing_template_id UUID REFERENCES public.routing_templates(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.requirements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read requirements" ON public.requirements FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admins can manage requirements" ON public.requirements FOR ALL USING (public.get_user_role() IN ('admin', 'system_admin'));

-- 4. Submissions
CREATE TABLE public.submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  intern_id UUID NOT NULL REFERENCES public.users(id),
  requirement_id UUID NOT NULL REFERENCES public.requirements(id),
  state public.submission_state NOT NULL DEFAULT 'DRAFT',
  current_step INTEGER NOT NULL DEFAULT 0,
  current_holder_id UUID REFERENCES public.users(id),
  due_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Interns can read own submissions" ON public.submissions FOR SELECT USING (intern_id = auth.uid());
CREATE POLICY "Approvers can read held submissions" ON public.submissions FOR SELECT USING (current_holder_id = auth.uid() OR public.get_user_role() IN ('admin', 'system_admin'));
CREATE POLICY "Interns can update own submissions" ON public.submissions FOR UPDATE USING (intern_id = auth.uid());
CREATE POLICY "Admins/System Admins can update any submission" ON public.submissions FOR UPDATE USING (public.get_user_role() IN ('admin', 'system_admin'));
CREATE POLICY "Approvers can update held submissions" ON public.submissions FOR UPDATE USING (current_holder_id = auth.uid());
CREATE POLICY "Interns can insert own submissions" ON public.submissions FOR INSERT WITH CHECK (intern_id = auth.uid());

-- 5. Submission Versions
CREATE TABLE public.submission_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  file_url TEXT NOT NULL,
  file_hash TEXT NOT NULL,
  is_superseded BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.submission_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read versions for readable submissions" ON public.submission_versions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_versions.submission_id)
);
CREATE POLICY "Interns can insert versions for own submissions" ON public.submission_versions FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_versions.submission_id AND s.intern_id = auth.uid())
);
CREATE POLICY "Users can update versions for readable submissions" ON public.submission_versions FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = submission_versions.submission_id)
);

-- 6. Approvals
CREATE TABLE public.approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  version_id UUID NOT NULL REFERENCES public.submission_versions(id),
  approver_id UUID NOT NULL REFERENCES public.users(id),
  step INTEGER NOT NULL,
  file_hash TEXT NOT NULL,
  signed_pdf_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read approvals for readable submissions" ON public.approvals FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = approvals.submission_id)
);
CREATE POLICY "Approvers can insert approvals" ON public.approvals FOR INSERT WITH CHECK (
  approver_id = auth.uid() AND EXISTS (SELECT 1 FROM public.submissions s WHERE s.id = approvals.submission_id AND s.current_holder_id = auth.uid())
);

-- Deferred Submissions Policies (Dependent on Approvals)
CREATE POLICY "Approvers can read previously assigned submissions" ON public.submissions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.approvals a WHERE a.submission_id = submissions.id AND a.approver_id = auth.uid())
);

-- 7. Audit Log
CREATE TABLE public.audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  target_id UUID,
  target_type TEXT,
  source_ip TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon, public;

CREATE POLICY "Anyone can insert audit logs" ON public.audit_log FOR INSERT WITH CHECK (true);
CREATE POLICY "Admins can read audit logs" ON public.audit_log FOR SELECT USING (public.get_user_role() IN ('admin', 'system_admin'));

-- 8. Notifications
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'unread',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can read own notifications" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own notifications" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "System can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
