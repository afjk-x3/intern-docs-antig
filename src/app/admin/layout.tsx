import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@lib/supabase/server';
import { RoleSidebar } from '@/components/RoleSidebar';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('email, role')
    .eq('id', user.id)
    .single();

  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    redirect('/login');
  }

  const navItems = [
    { label: 'Dashboard', href: '/admin/dashboard' },
    { label: 'Requirements', href: '/admin/requirements' },
    { label: 'Routing Templates', href: '/admin/routing-templates' },
    { label: 'Users', href: '/admin/users' },
    { label: 'Audit Log', href: '/admin/audit-log' },
    { label: 'Retention & Deletions', href: '/admin/retention' },
  ];

  return (
    <RoleSidebar
      roleTitle="Admin Console"
      userName={dbUser.email || 'Admin'}
      navItems={navItems}
    >
      {children}
    </RoleSidebar>
  );
}
