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

  // Fetch user role and internship dates
  const { data: userData } = await supabase
    .from('users')
    .select('role, internship_start, internship_end')
    .eq('id', user.id)
    .single();

  const role = userData?.role;

  if (role === 'intern') {
    if (!userData?.internship_start || !userData?.internship_end) {
      redirect('/onboarding');
    }
    redirect('/intern');
  }
  if (role === 'approver') redirect('/approver');
  if (role === 'admin' || role === 'system_admin') redirect('/admin');

  redirect('/onboarding');
}
