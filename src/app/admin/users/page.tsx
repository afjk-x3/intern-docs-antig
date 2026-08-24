import { inviteUser } from '@lib/data/auth';
import { AdminInviteForm } from '@/components/AdminInviteForm';

export default function UsersPage() {
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

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Users & Roles</h1>
        <p className="text-sm text-text-muted mt-1">Manage organization members and invitations.</p>
      </div>

      <AdminInviteForm onInviteAction={handleInvite} />
    </div>
  );
}
