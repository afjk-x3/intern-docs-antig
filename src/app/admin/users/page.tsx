import { inviteUser } from '@lib/data/auth';

export default function UsersPage() {
  async function handleInvite(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    await inviteUser(email, role);
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Users & Roles</h1>
        <p className="text-sm text-text-muted mt-1">Manage organization members and invitations.</p>
      </div>

      <div className="bg-surface-bg p-6 rounded-xl shadow-xs border border-border-default max-w-3xl">
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
    </div>
  );
}
