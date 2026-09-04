import { requestPasswordReset } from '@lib/data/auth';
import { ForgotPasswordForm } from '@/components/ForgotPasswordForm';
import { Logo } from '@/components/Logo';

export const metadata = {
  title: 'Forgot Password — InternDocs',
  description: 'Request a password reset link to regain access to your InternDocs account.',
};

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;

  async function handleRequestReset(email: string) {
    'use server';
    try {
      return await requestPasswordReset(email);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to request password reset.';
      return { success: false, error: msg };
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* ─── Left brand panel (visible md+) ─── */}
      <div
        className="
          hidden md:flex md:w-[44%] lg:w-[42%]
          relative overflow-hidden
          flex-col justify-between
          bg-brand-primary text-white
          p-10 lg:p-14
        "
      >
        {/* Decorative geometric shapes */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          <div className="absolute -top-28 -right-28 w-72 h-72 rounded-full border-2 border-brand-accent/15" />
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full border border-brand-accent/10" />
          <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full border-2 border-white/[0.06]" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-brand-accent/[0.06]" />
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-brand-accent/20 via-white/5 to-transparent" />
          <svg className="absolute top-1/3 left-8 opacity-[0.04]" width="120" height="120" viewBox="0 0 120 120" fill="white">
            {Array.from({ length: 36 }).map((_, i) => (
              <circle key={i} cx={10 + (i % 6) * 20} cy={10 + Math.floor(i / 6) * 20} r="2" />
            ))}
          </svg>
        </div>

        {/* Top — InternDocs logo */}
        <div className="relative z-10">
          <Logo onDark markClassName="h-12 w-12" textClassName="text-2xl" />
        </div>

        {/* Center — hero text */}
        <div className="relative z-10 -mt-8">
          <h1 className="text-4xl lg:text-[3.25rem] font-extrabold leading-[1.08] tracking-tight">
            Reset
            <br />
            <span className="text-brand-accent-on-dark">access.</span>
          </h1>
          <p className="mt-5 text-[15px] text-white/55 leading-relaxed max-w-xs">
            Quickly recover your account and get back to tracking requirements and uploading submissions.
          </p>
        </div>

        {/* Bottom — footer */}
        <div className="relative z-10 flex items-center gap-2">
          <div className="w-1 h-4 rounded-full bg-brand-accent/60" aria-hidden="true" />
          <p className="text-xs text-white/30 tracking-wide">
            © {new Date().getFullYear()} Makerspace InnovHub
          </p>
        </div>
      </div>

      {/* ─── Right form panel ─── */}
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-10 lg:px-20 py-10 bg-surface-muted">
        {/* Mobile-only brand header */}
        <div className="md:hidden mb-10">
          <Logo markClassName="h-11 w-11" textClassName="text-2xl" className="mb-6" />
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
            Reset <span className="text-brand-accent">access.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Enter your email to receive recovery instructions.
          </p>
        </div>

        {/* Desktop subheading */}
        <div className="hidden md:block mb-8">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">
            Recover your account
          </h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Enter your email address and we&apos;ll send you a password reset link.
          </p>
        </div>

        {/* Form container */}
        <div className="w-full max-w-sm">
          <ForgotPasswordForm
            initialError={error}
            onRequestReset={handleRequestReset}
          />

          {/* Bottom accent line on mobile */}
          <div className="md:hidden mt-10 flex items-center gap-2">
            <div className="w-1 h-4 rounded-full bg-brand-accent/40" aria-hidden="true" />
            <p className="text-xs text-text-muted/50 tracking-wide">
              © {new Date().getFullYear()} Makerspace InnovHub
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
