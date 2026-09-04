import { registerInternWithPassword } from '@lib/data/auth';
import { RegisterForm } from '@/components/RegisterForm';
import { Logo } from '@/components/Logo';

export const metadata = {
  title: 'Intern Registration — InternDocs',
  description: 'Submit your intern registration and OJT duration to join the Makerspace InnovHub cohort.',
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const error = resolvedSearchParams.error;

  async function handleRegister(formData: FormData) {
    'use server';
    try {
      const result = await registerInternWithPassword(formData);
      return result;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Registration failed';
      return { success: false, error: msg };
    }
  }

  return (
    <div className="flex min-h-screen bg-white">
      {/* ─── Left brand panel (visible md+) ─── */}
      <div
        className="
          hidden md:flex md:w-[42%] lg:w-[38%]
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
            Start your
            <br />
            <span className="text-brand-accent">journey.</span>
          </h1>
          <p className="mt-5 text-[15px] text-white/55 leading-relaxed max-w-xs">
            Join the Makerspace InnovHub cohort. Register your credentials and OJT duration to get started.
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
      <div className="flex flex-1 flex-col justify-center px-6 sm:px-10 lg:px-16 py-10 bg-surface-muted overflow-y-auto">
        {/* Mobile-only brand header */}
        <div className="md:hidden mb-6">
          <Logo markClassName="h-11 w-11" textClassName="text-2xl" className="mb-4" />
          <h1 className="text-3xl font-extrabold text-text-primary tracking-tight leading-tight">
            Start your <span className="text-brand-accent">journey.</span>
          </h1>
          <p className="mt-1.5 text-xs text-text-muted">
            Provide your details and internship duration to register.
          </p>
        </div>

        {/* Desktop subheading */}
        <div className="hidden md:block mb-5 max-w-md">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">
            Intern Self-Registration
          </h2>
          <p className="mt-1 text-xs text-text-muted">
            Fill in your account details, school, and OJT duration. Your registration will be reviewed by an administrator.
          </p>
        </div>

        {/* Form container */}
        <div className="w-full max-w-md">
          <RegisterForm
            error={error}
            onRegisterAction={handleRegister}
          />

          {/* Bottom accent line on mobile */}
          <div className="md:hidden mt-8 flex items-center gap-2">
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
