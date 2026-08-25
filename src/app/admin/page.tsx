<<<<<<< HEAD
import { inviteUser } from '@lib/data/auth';
import { getRequirements, createRequirement } from '@lib/data/requirements';
import { getRoutingTemplates, createRoutingTemplate } from '@lib/data/routing';
import { AdminRequirementManager, CreateRequirementInput, CreateRoutingTemplateInput } from '@/components/AdminRequirementManager';
import { AdminInviteForm } from '@/components/AdminInviteForm';
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
    try {
      const email = formData.get('email') as string;
      const role = formData.get('role') as string;
      const res = await inviteUser(email, role);
      return { success: true, inviteLink: res.inviteLink };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      return { error: msg };
    }
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
        <AdminInviteForm onInviteAction={handleInvite} />

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
=======
import { redirect } from 'next/navigation';

export default function AdminRootPage() {
  redirect('/admin/dashboard');
>>>>>>> c60df75c096beb71269564c93f7e6817d603a9f1
}
