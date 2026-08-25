import { login } from '@lib/data/auth';
import { redirect } from 'next/navigation';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string, reason?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;
  const reason = resolvedSearchParams.reason;

  async function handleLogin(formData: FormData) {
    'use server';
    let isSuccess = false;
    try {
      const result = await login(formData);
      if (!result.success) throw new Error(result.error);
      isSuccess = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Login failed';
      redirect(`/login?error=${encodeURIComponent(msg)}`);
    }

    if (isSuccess) {
      redirect('/');
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-lg bg-surface-bg p-6 shadow-md border border-border-default">
        <h1 className="mb-2 text-2xl font-bold text-text-primary text-center">InternDocs</h1>
        <p className="mb-6 text-sm text-text-muted text-center">Sign in to your account</p>
        
        {reason === 'timeout' && (
          <div className="mb-4 rounded bg-yellow-50 p-3 text-sm text-yellow-800 border border-yellow-200">
            Your session expired due to inactivity. Please log in again.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded bg-red-50 p-3 text-sm text-red-800 border border-red-200">
            {error}
          </div>
        )}

        <form action={handleLogin} className="flex flex-col space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded border border-border-default p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary" htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              required
              className="w-full rounded border border-border-default p-2 text-sm text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>
          <button
            type="submit"
            className="mt-2 w-full rounded bg-brand-primary py-2 text-white text-sm font-medium hover:bg-brand-primary-hover transition-colors"
          >
            Sign In
          </button>
        </form>
      </div>
    </div>
  );
}
