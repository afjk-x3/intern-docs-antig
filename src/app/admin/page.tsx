import { inviteUser } from '@lib/data/auth';

export default function AdminDashboard() {
  async function handleInvite(formData: FormData) {
    'use server';
    const email = formData.get('email') as string;
    const role = formData.get('role') as string;
    await inviteUser(email, role);
  }

  return (
    <div className="min-h-screen p-8 bg-surface-muted">
      <div className="max-w-2xl mx-auto bg-surface-bg p-6 rounded-lg shadow border border-border-default">
        <h1 className="text-2xl font-bold text-text-primary mb-6">Admin Dashboard</h1>
        
        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-semibold mb-4">Invite New User</h2>
          <form action={handleInvite} className="flex flex-col space-y-4 max-w-sm">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-1">Email</label>
            <input 
              type="email" 
              name="email"
              required
              className="w-full border border-border-default rounded p-2 text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1">Role</label>
            <select 
              name="role"
              className="w-full border border-border-default rounded p-2 text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
            >
                <option value="intern">Intern</option>
                <option value="approver">Approver</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button 
            type="submit"
            className="w-full bg-brand-primary text-white py-2 rounded font-medium hover:bg-brand-primary-hover transition-colors"
          >Send Invite</button>
          </form>
        </div>
      </div>
    </div>
  );
}
