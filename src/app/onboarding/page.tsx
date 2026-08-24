import { updateInternshipDates } from '@lib/data/users';
import { redirect } from 'next/navigation';

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;

  async function handleOnboarding(formData: FormData) {
    'use server';
    const start = formData.get('start') as string;
    const end = formData.get('end') as string;
    const privacyAck = formData.get('privacy_ack') as string;

    if (!privacyAck) {
      redirect(`/onboarding?error=${encodeURIComponent('You must acknowledge the Data Privacy & Retention Policy to proceed.')}`);
    }

    try {
<<<<<<< Updated upstream
      await updateInternshipDates(start, end);
=======
      await updateInternshipDates(start, end, true);
>>>>>>> Stashed changes
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to set dates';
      redirect(`/onboarding?error=${encodeURIComponent(msg)}`);
    }

    redirect('/');
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-surface-muted">
      <div className="w-full max-w-lg rounded-2xl bg-surface-bg p-8 shadow-sm border border-border-default space-y-6">
        <div className="text-center space-y-1.5">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white font-bold text-lg mb-1">
            ID
          </div>
          <h1 className="text-xl font-bold text-text-primary">Internship Onboarding</h1>
          <p className="text-xs text-text-muted">
            Configure your internship duration and review data handling policies.
          </p>
        </div>

        {error && (
          <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200" role="alert">
            {error}
          </div>
        )}

        <form action={handleOnboarding} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5" htmlFor="start">
                Start Date
              </label>
              <input
                id="start"
                name="start"
                type="date"
                required
                aria-required="true"
                className="w-full rounded-xl border border-border-default p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-text-primary mb-1.5" htmlFor="end">
                End Date
              </label>
              <input
                id="end"
                name="end"
                type="date"
                required
                aria-required="true"
                className="w-full rounded-xl border border-border-default p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
            </div>
          </div>

          {/* Privacy & Retention Notice (FR-25) */}
          <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 text-xs space-y-2 text-slate-700">
            <h2 className="font-bold text-slate-900 flex items-center gap-1.5">
              <span>📋</span> Data Privacy &amp; 30-Day Retention Notice
            </h2>
            <p className="text-[11px] leading-relaxed text-slate-600">
              In accordance with Makerspace document policies:
            </p>
            <ul className="list-disc list-inside space-y-1 text-[11px] text-slate-600">
              <li>Uploaded documents are private and strictly accessible only to you, your assigned supervisor, and authorized administrators.</li>
              <li>Signed PDFs are sealed with digital SHA-256 integrity checksums upon approval.</li>
              <li>Storage bytes are automatically purged <strong>30 days after approval</strong> (or 30 days post-internship), with metadata and approval audit history preserved.</li>
            </ul>
          </div>

          {/* Acknowledgment Checkbox */}
          <div className="flex items-start gap-2.5 pt-1">
            <input
              id="privacy_ack"
              name="privacy_ack"
              type="checkbox"
              required
              aria-required="true"
              className="mt-0.5 h-4 w-4 rounded border-border-default text-brand-primary focus:ring-brand-primary cursor-pointer"
            />
            <label htmlFor="privacy_ack" className="text-xs text-text-primary cursor-pointer font-medium">
              I have read, understood, and agree to the InternDocs Data Privacy &amp; Document Retention Policy.
            </label>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-brand-primary py-2.5 text-white text-xs font-semibold hover:bg-brand-primary-hover transition-colors shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-primary"
          >
            Acknowledge &amp; Enter Portal
          </button>
        </form>
      </div>
    </div>
  );
}
