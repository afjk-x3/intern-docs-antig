import { completeInternOnboarding, setFullName } from '@lib/data/users';
import { redirect } from 'next/navigation';
import { createClient } from '@lib/supabase/server';
import { Button } from '@/components/ui/button';

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
    .select('privacy_acknowledged_at, full_name, school, batch, internship_start, internship_end')
    .eq('id', user.id)
    .single();

  if (!dbUser?.privacy_acknowledged_at) {
    redirect('/privacy-notice');
  }

  async function handleOnboarding(formData: FormData) {
    'use server';
    const fullName = (formData.get('full_name') as string) || '';
    const school = (formData.get('school') as string) || '';
    const batch = (formData.get('batch') as string) || '';
    const start = (formData.get('start') as string) || '';
    const end = (formData.get('end') as string) || '';

    // redirect() must not be called inside this try -- it works by throwing a special
    // NEXT_REDIRECT error that Next.js's own framework code catches further up the
    // stack, so a catch block here intercepts it first and mistakes it for a real
    // failure. src/app/privacy-notice/page.tsx's handleAcknowledge already gets this
    // right (its success redirect sits after the try/catch) -- mirrored here.
    let saveError: string | null = null;
    try {
      // setFullName is the same helper the approver Signature Settings page uses to
      // edit this field later (lib/data/users.ts) -- reused as-is here rather than
      // folding full_name into completeInternOnboarding's own schema/update.
      await setFullName(fullName);
      await completeInternOnboarding(school, batch, start, end);
    } catch (e: unknown) {
      saveError = e instanceof Error ? e.message : 'Failed to save onboarding details';
    }

    if (saveError) {
      redirect(`/onboarding?error=${encodeURIComponent(saveError)}`);
    }
    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-surface-muted">
      <div className="w-full max-w-md rounded-2xl bg-surface-bg p-8 shadow-xs border border-border-default space-y-6">
        <div className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold text-text-primary">Intern Profile &amp; Duration</h1>
          <p className="text-xs text-text-muted">
            Please enter your university, cohort batch, and internship duration to complete your setup.
          </p>
        </div>

        {error && (
          <div role="alert" className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200">
            {error}
          </div>
        )}

        <form action={handleOnboarding} className="space-y-4">
          {/* Full Name field -- the printed name composited onto signed PDFs (FR-11) */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary" htmlFor="full_name">
              Full Name <span className="text-rose-500">*</span>
            </label>
            <input
              id="full_name"
              name="full_name"
              type="text"
              required
              minLength={2}
              maxLength={150}
              defaultValue={dbUser?.full_name || ''}
              placeholder="e.g. Juan Dela Cruz"
              className="w-full rounded-xl border border-border-default bg-white px-3.5 py-2.5 text-xs text-text-primary placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
            />
            <p className="mt-1.5 text-[11px] text-text-muted">
              This is the printed name shown wherever your identity appears on a document.
            </p>
          </div>

          {/* School / University field */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary" htmlFor="school">
              School / University <span className="text-rose-500">*</span>
            </label>
            <input
              id="school"
              name="school"
              type="text"
              required
              maxLength={200}
              defaultValue={dbUser?.school || ''}
              placeholder="e.g. University of the Philippines"
              className="w-full rounded-xl border border-border-default bg-white px-3.5 py-2.5 text-xs text-text-primary placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
            />
          </div>

          {/* Batch / Year field */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary" htmlFor="batch">
              Batch / Academic Year <span className="text-rose-500">*</span>
            </label>
            <input
              id="batch"
              name="batch"
              type="text"
              required
              maxLength={100}
              defaultValue={dbUser?.batch || ''}
              placeholder="e.g. Batch 2026-A"
              className="w-full rounded-xl border border-border-default bg-white px-3.5 py-2.5 text-xs text-text-primary placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
            />
          </div>

          {/* Start Date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary" htmlFor="start">
              Internship Start Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="start"
              name="start"
              type="date"
              required
              defaultValue={dbUser?.internship_start || ''}
              className="w-full rounded-xl border border-border-default bg-white px-3.5 py-2.5 text-xs text-text-primary placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
            />
          </div>

          {/* End Date */}
          <div>
            <label className="mb-1 block text-xs font-semibold text-text-primary" htmlFor="end">
              Internship End Date <span className="text-rose-500">*</span>
            </label>
            <input
              id="end"
              name="end"
              type="date"
              required
              defaultValue={dbUser?.internship_end || ''}
              className="w-full rounded-xl border border-border-default bg-white px-3.5 py-2.5 text-xs text-text-primary placeholder:text-slate-400 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
            />
          </div>

          <Button type="submit" className="mt-4 w-full rounded-xl py-3 text-xs tracking-wide shadow-xs" size="lg">
            Complete Profile &amp; Enter Portal
          </Button>
        </form>
      </div>
    </div>
  );
}
