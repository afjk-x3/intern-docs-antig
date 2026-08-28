import { inviteUser } from '@lib/data/auth';
import { getInternGroupOptions } from '@lib/data/users';
import { AdminInviteForm } from '@/components/AdminInviteForm';

export default async function AdminUsersPage() {
  const { schools, batches } = await getInternGroupOptions();

  async function handleInvite(formData: FormData) {
    'use server';
    try {
      const email = formData.get('email') as string;
      const school = formData.get('school') as string;
      const batch = formData.get('batch') as string;
      // Admins can only invite interns (approver & admin roles managed by system_admin)
      const res = await inviteUser(email, 'intern', school, batch);
      return { success: true, inviteLink: res.inviteLink };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      return { error: msg };
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Users</h1>
        <p className="text-sm text-text-muted mt-1">
          Send onboarding invitations to new interns in the cohort.
        </p>
      </div>

      {/* Invite Form restricted to Intern role */}
      <AdminInviteForm
        onInviteAction={handleInvite}
        allowedRoles={[{ value: 'intern', label: 'Intern' }]}
        existingSchools={schools}
        existingBatches={batches}
      />
    </div>
  );
}
