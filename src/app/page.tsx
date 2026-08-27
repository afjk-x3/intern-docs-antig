import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch user role, internship dates, and privacy notice acknowledgement
  const { data: userData } = await supabase
    .from('users')
    .select('role, internship_start, internship_end, privacy_acknowledged_at')
    .eq('id', user.id)
    .single();

  if (!userData?.privacy_acknowledged_at) {
    redirect('/privacy-notice');
  }

  const role = userData?.role;

  if (role === 'system_admin') redirect('/system-admin');
  if (role === 'admin') redirect('/admin');
  if (role === 'approver') redirect('/approver');
  if (role === 'intern') {
    if (!userData?.internship_start || !userData?.internship_end) {
      redirect('/onboarding');
    }
    redirect('/intern');
  }

  redirect('/onboarding');
}
