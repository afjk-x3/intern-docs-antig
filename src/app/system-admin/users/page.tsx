import { inviteUser } from '@lib/data/auth';
import { updateUserRole, updateUserGroup, updateInternshipDatesAsAdmin, getInternGroupOptions } from '@lib/data/users';
import { AdminInviteForm } from '@/components/AdminInviteForm';
import { UserManagementTable } from '@/components/UserManagementTable';
import { createAdminClient } from '@lib/supabase/admin';

export const dynamic = 'force-dynamic';

export default async function SystemAdminUsersPage() {
  const adminClient = createAdminClient();
  const [{ data: users }, { schools, batches }] = await Promise.all([
    adminClient
      .from('users')
      .select('id, email, role, internship_start, internship_end, school, batch, created_at')
      .order('created_at', { ascending: false }),
    getInternGroupOptions(),
  ]);

  async function handleInvite(formData: FormData) {
    'use server';
    try {
      const email = formData.get('email') as string;
      const role = formData.get('role') as string;
      const school = formData.get('school') as string;
      const batch = formData.get('batch') as string;
      const res = await inviteUser(email, role, school, batch);
      return { success: true, inviteLink: res.inviteLink };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      return { error: msg };
    }
  }

  async function handleRoleChange(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    const newRole = formData.get('role') as string;
    await updateUserRole(userId, newRole);
  }

  async function handleGroupChange(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    const school = formData.get('school') as string;
    const batch = formData.get('batch') as string;
    await updateUserGroup(userId, school, batch);
  }

  async function handleDatesChange(formData: FormData) {
    'use server';
    const userId = formData.get('userId') as string;
    const start = formData.get('start') as string;
    const end = formData.get('end') as string;
    try {
      await updateInternshipDatesAsAdmin(userId, start, end);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to update internship dates';
      return { error: msg };
    }
  }

  const userList = users || [];

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">User &amp; Role Management</h1>
        <p className="text-sm text-text-muted mt-1">
          Invite members, control role-based access control (RBAC), and manage system permissions.
        </p>
      </div>

      {/* Invite Form with all role capabilities */}
      <AdminInviteForm
        onInviteAction={handleInvite}
        allowedRoles={[
          { value: 'intern', label: 'Intern' },
          { value: 'approver', label: 'Approver' },
          { value: 'admin', label: 'Admin' },
          { value: 'system_admin', label: 'System Admin' },
        ]}
        existingSchools={schools}
        existingBatches={batches}
      />

      {/* Filterable Users Table */}
      <UserManagementTable
        users={userList}
        onRoleChangeAction={handleRoleChange}
        onGroupChangeAction={handleGroupChange}
        onDatesChangeAction={handleDatesChange}
      />
    </div>
  );
}
