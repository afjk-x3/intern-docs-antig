'use client';

import React, { useState, useMemo } from 'react';
import { ConfirmAction } from '@/components/ConfirmAction';

export interface ManagedUser {
  id: string;
  email: string;
  role: 'intern' | 'approver' | 'admin' | 'system_admin' | string;
  internship_start?: string | null;
  internship_end?: string | null;
  created_at: string;
}

interface UserManagementTableProps {
  users: ManagedUser[];
  onRoleChangeAction: (formData: FormData) => Promise<void>;
}

export function UserManagementTable({ users, onRoleChangeAction }: UserManagementTableProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pendingChange, setPendingChange] = useState<{ user: ManagedUser; nextRole: string } | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const matchesSearch = u.email.toLowerCase().includes(searchTerm.toLowerCase().trim());
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });
  }, [users, searchTerm, roleFilter]);

  const roleCounts = useMemo(() => {
    return {
      ALL: users.length,
      intern: users.filter((u) => u.role === 'intern').length,
      approver: users.filter((u) => u.role === 'approver').length,
      admin: users.filter((u) => u.role === 'admin').length,
      system_admin: users.filter((u) => u.role === 'system_admin').length,
    };
  }, [users]);

  const handleRoleFormSubmit = (e: React.FormEvent<HTMLFormElement>, user: ManagedUser) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const nextRole = formData.get('role') as string;
    if (nextRole === user.role) return;
    setConfirmError(null);
    setPendingChange({ user, nextRole });
  };

  const handleConfirmRoleChange = async () => {
    if (!pendingChange) return;
    const { user, nextRole } = pendingChange;
    setIsUpdating(user.id);
    setConfirmError(null);
    try {
      const formData = new FormData();
      formData.set('userId', user.id);
      formData.set('role', nextRole);
      await onRoleChangeAction(formData);
      setPendingChange(null);
      setStatusMessage(`Role successfully updated.`);
      setTimeout(() => setStatusMessage(null), 3000);
    } catch (e: unknown) {
      setConfirmError(e instanceof Error ? e.message : 'Failed to update role.');
    } finally {
      setIsUpdating(null);
    }
  };

  return (
    <div className="bg-surface-bg border border-border-default rounded-2xl p-6 shadow-xs space-y-5">
      {/* Top Header & Search / Filter Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="font-bold text-sm text-text-primary flex items-center gap-2">
            <span>Registered Users</span>
            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700">
              {filteredUsers.length} of {users.length}
            </span>
          </h2>
          <p className="text-xs text-text-muted mt-0.5">Filter by role or search by email address.</p>
        </div>

        {statusMessage && (
          <div className="text-xs font-medium text-emerald-800 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200 animate-in fade-in">
            ✓ {statusMessage}
          </div>
        )}
      </div>

      {/* Search Bar */}
      <div className="pt-1">
        <div className="relative w-full">
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users by email address..."
            className="w-full pl-9 pr-8 py-2 rounded-xl border border-border-default text-xs text-text-primary placeholder:text-text-muted bg-white focus:border-brand-primary outline-none"
          />
          <span className="absolute left-3 top-2.5 text-slate-400 text-xs">🔍</span>
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-2 text-xs text-slate-400 hover:text-slate-600 font-bold"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* Role Pill Filters */}
      <div className="flex flex-wrap gap-1.5 text-xs">
        {[
          { key: 'ALL', label: 'All', count: roleCounts.ALL },
          { key: 'intern', label: 'Interns', count: roleCounts.intern },
          { key: 'approver', label: 'Approvers', count: roleCounts.approver },
          { key: 'admin', label: 'Admins', count: roleCounts.admin },
          { key: 'system_admin', label: 'System Admins', count: roleCounts.system_admin },
        ].map((pill) => (
          <button
            key={pill.key}
            onClick={() => setRoleFilter(pill.key)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
              roleFilter === pill.key
                ? 'bg-brand-primary text-white'
                : 'bg-surface-muted text-text-muted hover:bg-slate-200/60'
            }`}
          >
            {pill.label} ({pill.count})
          </button>
        ))}
      </div>

      {/* User Table */}
      <div className="overflow-x-auto border border-border-default rounded-xl" tabIndex={0} role="region" aria-label="User list">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="border-b border-border-default text-text-muted bg-surface-muted">
              <th className="py-3 px-4 font-semibold">User / Email</th>
              <th className="py-3 px-4 font-semibold">Current Role</th>
              <th className="py-3 px-4 font-semibold">Internship Dates</th>
              <th className="py-3 px-4 font-semibold">Change Role</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border-default">
            {filteredUsers.map((u) => (
              <tr key={u.id} className="hover:bg-slate-50 transition-colors">
                <td className="py-3.5 px-4 font-medium text-text-primary">
                  {u.email}
                </td>
                <td className="py-3.5 px-4">
                  <span
                    className={`inline-block px-2.5 py-0.5 rounded-full font-semibold text-[10px] uppercase tracking-wider ${
                      u.role === 'system_admin'
                        ? 'bg-purple-100 text-purple-800'
                        : u.role === 'admin'
                        ? 'bg-blue-100 text-blue-800'
                        : u.role === 'approver'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                <td className="py-3.5 px-4 text-text-muted font-mono text-[11px]">
                  {u.internship_start && u.internship_end
                    ? `${u.internship_start} to ${u.internship_end}`
                    : '—'}
                </td>
                <td className="py-3.5 px-4">
                  <form
                    onSubmit={(e) => handleRoleFormSubmit(e, u)}
                    className="flex items-center gap-2"
                  >
                    <label htmlFor={`role-${u.id}`} className="sr-only">
                      Change role for {u.email}
                    </label>
                    <select
                      id={`role-${u.id}`}
                      name="role"
                      defaultValue={u.role}
                      className="rounded-lg border border-border-default p-1.5 text-xs bg-white text-text-primary focus:border-brand-primary outline-none"
                    >
                      <option value="intern">Intern</option>
                      <option value="approver">Approver</option>
                      <option value="admin">Admin</option>
                      <option value="system_admin">System Admin</option>
                    </select>
                    <button
                      type="submit"
                      disabled={isUpdating === u.id}
                      className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50 transition-colors shadow-xs"
                    >
                      {isUpdating === u.id ? 'Saving...' : 'Save'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}

            {filteredUsers.length === 0 && (
              <tr>
                <td colSpan={4} className="py-10 text-center text-text-muted">
                  <div className="space-y-1">
                    <p className="font-semibold text-text-primary">No users found</p>
                    <p className="text-xs">No registered accounts match your current filter or search.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {pendingChange && (
        <ConfirmAction
          open={!!pendingChange}
          onOpenChange={(open) => !open && setPendingChange(null)}
          title="Change user role?"
          description="This changes what the user can access immediately and is recorded in the audit log."
          confirmLabel="Change Role"
          variant="destructive"
          isLoading={isUpdating === pendingChange.user.id}
          loadingLabel="Saving…"
          error={confirmError}
          onConfirm={handleConfirmRoleChange}
        >
          <div className="rounded-xl bg-surface-muted border border-border-default p-3.5 text-sm space-y-1.5">
            <div>
              <strong className="text-text-primary">{pendingChange.user.email}</strong>
            </div>
            <div className="text-text-muted">
              <strong className="text-rose-700">{pendingChange.user.role}</strong>
              {' → '}
              <strong className="text-emerald-700">{pendingChange.nextRole}</strong>
            </div>
          </div>
        </ConfirmAction>
      )}
    </div>
  );
}
