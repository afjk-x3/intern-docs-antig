import { login } from '@lib/data/auth';
import { redirect } from 'next/navigation';
import { LoginForm } from '@/components/LoginForm';
import Image from 'next/image';

export const metadata = {
  title: 'Sign In — InternDocs',
  description: 'Sign in to your InternDocs account to manage internship documents and requirements.',
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; reason?: string }>;
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
        {/* Decorative geometric shapes echoing the logo's swirl motif */}
        <div className="absolute inset-0 pointer-events-none select-none" aria-hidden="true">
          {/* Large swirl-inspired ring — top right, clipped */}
          <div className="absolute -top-28 -right-28 w-72 h-72 rounded-full border-2 border-brand-accent/15" />
          <div className="absolute -top-16 -right-16 w-52 h-52 rounded-full border border-brand-accent/10" />
          {/* Smaller accent ring — bottom left */}
          <div className="absolute -bottom-20 -left-20 w-56 h-56 rounded-full border-2 border-white/[0.06]" />
          <div className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-brand-accent/[0.06]" />
          {/* Horizontal gradient line */}
          <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-brand-accent/20 via-white/5 to-transparent" />
          {/* Subtle dot grid */}
          <svg className="absolute top-1/3 left-8 opacity-[0.04]" width="120" height="120" viewBox="0 0 120 120" fill="white">
            {Array.from({ length: 36 }).map((_, i) => (
              <circle key={i} cx={10 + (i % 6) * 20} cy={10 + Math.floor(i / 6) * 20} r="2" />
            ))}
          </svg>
        </div>

        {/* Top — Makerspace logo */}
        <div className="relative z-10">
          <Image
            src="/makerspace-brand.png"
            alt="Makerspace InnovHub"
            width={220}
            height={56}
            className="brightness-0 invert opacity-90"
            priority
          />
        </div>

        {/* Center — hero text */}
        <div className="relative z-10 -mt-8">
          <h1 className="text-4xl lg:text-[3.25rem] font-extrabold leading-[1.08] tracking-tight">
            Welcome
            <br />
            <span className="text-brand-accent">back.</span>
          </h1>
          <p className="mt-5 text-[15px] text-white/55 leading-relaxed max-w-xs">
            Track your internship requirements, upload documents, and stay on top of deadlines — all in one place.
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
          <Image
            src="/makerspace-brand.png"
            alt="Makerspace InnovHub"
            width={180}
            height={46}
            className="mb-6"
            priority
          />
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
            Welcome <span className="text-brand-accent">back.</span>
          </h1>
          <p className="mt-2 text-sm text-text-muted">
            Sign in to continue to your dashboard.
          </p>
        </div>

        {/* Desktop subheading */}
        <div className="hidden md:block mb-8">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">
            Sign in to your account
          </h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Enter your credentials to continue.
          </p>
        </div>

        {/* Form container */}
        <div className="w-full max-w-sm">
          <LoginForm
            error={error}
            reason={reason}
            onLoginAction={handleLogin}
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
