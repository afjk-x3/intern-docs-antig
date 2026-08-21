import { inviteUser } from '@lib/data/auth';
import { getRequirements, createRequirement } from '@lib/data/requirements';
import { getRoutingTemplates, createRoutingTemplate } from '@lib/data/routing';
import { AdminRequirementManager, CreateRequirementInput, CreateRoutingTemplateInput } from '@/components/AdminRequirementManager';
import { createClient } from '@lib/supabase/server';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const [requirements, routingTemplates] = await Promise.all([
    getRequirements(),
    getRoutingTemplates(),
  ]);

  async function handleInvite(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    await inviteUser(email, role);
  }

  async function handleCreateReq(data: CreateRequirementInput) {
    'use server';
    try {
      await createRequirement({
        ...data,
        description: data.description || '',
      });
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create requirement';
      return { error: msg };
    }
  }

  async function handleCreateTpl(data: CreateRoutingTemplateInput) {
    'use server';
    try {
      await createRoutingTemplate(data);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create template';
      return { error: msg };
    }
  }

  return (
    <div className="min-h-screen p-6 md:p-10 bg-surface-muted">
      <div className="max-w-5xl mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-brand-primary flex items-center justify-center text-white font-bold">
              ID
            </div>
            <div>
              <h1 className="text-xl font-bold text-text-primary">Admin Console</h1>
              <p className="text-xs text-text-muted">Organization users, requirements, and workflows</p>
            </div>
          </div>

          <form action="/auth/signout" method="post">
            <button
              type="submit"
              className="text-xs text-text-muted hover:text-text-primary font-medium px-3 py-1.5 rounded-lg border border-border-default bg-surface-bg hover:bg-slate-50 transition-colors"
            >
              Sign out
            </button>
          </form>
        </div>

        {/* User Invitation Section */}
        <div className="bg-surface-bg p-6 rounded-xl shadow-xs border border-border-default">
          <h2 className="text-base font-bold text-text-primary mb-1">Invite New User</h2>
          <p className="text-xs text-text-muted mb-4">Send an onboarding invitation with assigned organizational role.</p>
          <form action={handleInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Email Address</label>
              <input
                type="email"
                name="email"
                required
                placeholder="user@makerspace.ph"
                className="w-full border border-border-default rounded-lg p-2 text-xs text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1">Role</label>
              <select
                name="role"
                className="w-full border border-border-default rounded-lg p-2 text-xs text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
              >
                <option value="intern">Intern</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                className="w-full bg-brand-primary text-white py-2 px-4 rounded-lg text-xs font-semibold hover:bg-brand-primary-hover transition-colors"
              >
                Send Invite
              </button>
            </div>
          </form>
        </div>

        {/* Requirement Definitions & Workflows */}
        <AdminRequirementManager
          requirements={requirements}
          routingTemplates={routingTemplates}
          onCreateRequirement={handleCreateReq}
          onCreateTemplate={handleCreateTpl}
        />
      </div>
    </div>
  );
}
