import { inviteUser } from '@lib/data/auth';
import { getInternGroupOptions, getAllInternUsers, approveInternRegistration } from '@lib/data/users';
import { AdminInviteForm } from '@/components/AdminInviteForm';
import { AdminUsersTable } from '@/components/AdminUsersTable';

export const dynamic = 'force-dynamic';

export default async function AdminUsersPage() {
  const [{ schools, batches }, internUsers] = await Promise.all([
    getInternGroupOptions(),
    getAllInternUsers(),
  ]);

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

  async function handleApproveRegistration(userId: string) {
    'use server';
    try {
      await approveInternRegistration(userId);
      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to approve registration';
      return { error: msg };
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Users</h1>
        <p className="text-sm text-text-muted mt-1">
          Manage cohort admissions and invite new interns to Makerspace.
        </p>
      </div>

      {/* Manual Invite Form restricted to Intern role */}
      <AdminInviteForm
        onInviteAction={handleInvite}
        allowedRoles={[{ value: 'intern', label: 'Intern' }]}
        existingSchools={schools}
        existingBatches={batches}
      />

      {/* Full cohort: admitted interns and self-registered accounts awaiting approval */}
      <AdminUsersTable users={internUsers} onApproveAction={handleApproveRegistration} />
    </div>
  );
}
