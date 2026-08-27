import { updateInternshipDates } from '@lib/data/users';
import { redirect } from 'next/navigation';
import { createClient } from '@lib/supabase/server';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  const { data: dbUser } = await supabase
    .from('users')
    .select('privacy_acknowledged_at')
    .eq('id', user.id)
    .single();

  if (!dbUser?.privacy_acknowledged_at) {
    redirect('/privacy-notice');
  }

  async function handleOnboarding(formData: FormData) {
    'use server';
    const start = formData.get('start') as string;
    const end = formData.get('end') as string;

    try {
      await updateInternshipDates(start, end);
      redirect('/');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to set dates';
      redirect(`/onboarding?error=${encodeURIComponent(msg)}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg bg-surface-bg p-6 shadow-md border border-border-default">
        <h1 className="mb-2 text-2xl font-bold text-text-primary text-center">Internship Details</h1>
        <p className="mb-6 text-sm text-text-muted text-center">Please enter your internship duration. You can edit this later until your first submission is approved.</p>

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form action={handleOnboarding} className="flex flex-col space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="start">Start Date</label>
            <input
              id="start"
              name="start"
              type="date"
              required
              className="w-full rounded border border-border-default p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="end">End Date</label>
            <input
              id="end"
              name="end"
              type="date"
              required
              className="w-full rounded border border-border-default p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full rounded bg-brand-primary py-2 text-white text-sm font-medium hover:bg-brand-primary-hover transition-colors"
          >
            Save Details
          </button>
        </form>
      </div>
    </div>
  );
}
