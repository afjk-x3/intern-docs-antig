'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';

interface RegisterFormProps {
  error?: string | null;
  onRegisterAction: (formData: FormData) => Promise<{ success?: boolean; error?: string; email?: string }>;
}

export function RegisterForm({ error: initialError, onRegisterAction }: RegisterFormProps) {
  const [email, setEmail] = useState('');
  const [clientError, setClientError] = useState<string | null>(initialError || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setClientError(null);

    const trimmed = email.trim();
    if (!trimmed || !trimmed.includes('@')) {
      setClientError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append('email', trimmed);
      const res = await onRegisterAction(formData);
      if (res && !res.success) {
        setClientError(res.error || 'Registration failed. Please try again.');
      } else {
        setSubmittedEmail(trimmed);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Registration failed';
      setClientError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submittedEmail) {
    return (
      <div className="bg-surface-bg border border-border-default rounded-2xl p-6 text-center shadow-xs space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="space-y-1.5">
          <h3 className="text-base font-bold text-text-primary">Check your email</h3>
          <p className="text-xs text-text-muted leading-relaxed max-w-xs mx-auto">
            We sent an activation link to <strong className="text-text-primary">{submittedEmail}</strong>. Open the link to set your password and begin your onboarding.
          </p>
        </div>
        <div className="pt-2">
          <a
            href="/login"
            className="inline-flex items-center justify-center w-full rounded-xl bg-brand-primary py-2.5 text-xs font-semibold text-white hover:bg-brand-primary-hover shadow-xs transition-colors"
          >
            Return to Sign in
          </a>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Error banner */}
      {clientError && (
        <div
          role="alert"
          className="rounded-xl bg-rose-50 px-4 py-3 text-xs text-rose-800 border border-rose-200"
        >
          {clientError}
        </div>
      )}

      {/* Email field */}
      <div>
        <label
          htmlFor="register-email"
          className="block text-xs font-semibold text-text-primary mb-1"
        >
          Email address <span className="text-rose-500">*</span>
        </label>
        <input
          id="register-email"
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
          placeholder="intern@university.edu.ph"
          className="
            w-full rounded-xl border border-border-default bg-white
            px-3.5 py-2.5 text-xs text-text-primary
            placeholder:text-slate-400
            focus:border-brand-primary focus:ring-2 focus:ring-brand-primary/20
            focus:outline-none transition-all
          "
        />
        <p className="mt-1.5 text-[11px] text-text-muted">
          We&apos;ll send an activation link to this address to set up your password.
        </p>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        id="register-submit"
        disabled={isSubmitting}
        size="lg"
        className="w-full rounded-xl py-3 text-xs tracking-wide shadow-lg shadow-brand-primary/20 active:scale-[0.98] mt-2"
      >
        {isSubmitting ? 'Sending Link...' : 'Send Activation Link'}
      </Button>

      {/* Sign-in link */}
      <div className="pt-3 text-center border-t border-border-default">
        <p className="text-xs text-text-muted">
          Already have an account?{' '}
          <a
            href="/login"
            className="font-semibold text-brand-primary hover:text-brand-primary-hover hover:underline transition-colors"
          >
            Sign in
          </a>
        </p>
      </div>
    </form>
  );
}
