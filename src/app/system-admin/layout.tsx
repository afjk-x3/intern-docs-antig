import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@lib/supabase/server';
import { RoleSidebar } from '@/components/RoleSidebar';

export default async function SystemAdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('email, role, privacy_acknowledged_at')
    .eq('id', user.id)
    .single();

  if (!dbUser || dbUser.role !== 'system_admin') {
    // If regular admin, redirect to admin dashboard, else login
    if (dbUser?.role === 'admin') {
      redirect('/admin/dashboard');
    }
    redirect('/login');
  }

  if (!dbUser.privacy_acknowledged_at) {
    redirect('/privacy-notice');
  }

  const navItems = [
    { label: 'System Overview', href: '/system-admin' },
    { label: 'User & Role Management', href: '/system-admin/users' },
    { label: 'Security Audit Log', href: '/system-admin/audit-log' },
    { label: 'Retention & Deletions', href: '/system-admin/retention' },
    { label: 'Cohort Admin Console ↗', href: '/admin/dashboard' },
  ];

  return (
    <RoleSidebar
      roleTitle="System Admin"
      userName={dbUser.email || 'System Admin'}
      navItems={navItems}
    >
      {children}
    </RoleSidebar>
  );
}
