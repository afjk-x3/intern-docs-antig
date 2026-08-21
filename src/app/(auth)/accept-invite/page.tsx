import { updatePassword } from '@lib/data/auth';
import { redirect } from 'next/navigation';

export default async function AcceptInvitePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;

  async function handleUpdate(formData: FormData) {
    'use server';
    const password = formData.get('password') as string;
    
    if (password.length < 12) {
      redirect(`/accept-invite?error=${encodeURIComponent('Password must be at least 12 characters')}`);
    }

    try {
      await updatePassword(password);
      redirect('/');
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to set password';
      redirect(`/accept-invite?error=${encodeURIComponent(msg)}`);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg bg-surface-bg p-6 shadow-md border border-border-default">
        <h1 className="mb-2 text-2xl font-bold text-text-primary text-center">Accept Invitation</h1>
        <p className="mb-6 text-sm text-text-muted text-center">Please set your password to continue.</p>
        
        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form action={handleUpdate} className="flex flex-col space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="password">New Password</label>
            <input
              id="password"
              name="password"
              type="password"
              minLength={12}
              required
              className="w-full rounded border border-border-default p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <p className="mt-1 text-xs text-text-muted">Minimum 12 characters required.</p>
          </div>
          <button
            type="submit"
            className="w-full rounded bg-brand-primary py-2 text-white text-sm font-medium hover:bg-brand-primary-hover transition-colors"
          >
            Set Password
          </button>
        </form>
      </div>
    </div>
  );
}
