'use client';

import React, { useState, useEffect } from 'react';
import { createClient } from '@lib/supabase/client';

export default function AcceptInvitePage() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const supabase = createClient();

  useEffect(() => {
    async function initInviteAuth() {
      try {
        if (typeof window === 'undefined') return;

        // 1. Parse Hash Fragment (Supabase redirect with #access_token=...&refresh_token=...)
        if (window.location.hash && window.location.hash.includes('access_token')) {
          const hashParams = new URLSearchParams(window.location.hash.substring(1));
          const access_token = hashParams.get('access_token');
          const refresh_token = hashParams.get('refresh_token');

          if (access_token && refresh_token) {
            const { data, error } = await supabase.auth.setSession({
              access_token,
              refresh_token,
            });
            if (error) {
              console.warn('[Auth] setSession from hash error:', error.message);
            } else if (data.user) {
              setUserEmail(data.user.email || null);
            }
          }
        }

        // 2. Parse Query Params (PKCE code or OTP token_hash)
        const urlParams = new URLSearchParams(window.location.search);
        const token_hash = urlParams.get('token_hash');
        const type = urlParams.get('type') as 'invite' | 'recovery' | 'email' | null;
        const code = urlParams.get('code');

        if (token_hash && type) {
          const { data, error: otpErr } = await supabase.auth.verifyOtp({ token_hash, type });
          if (!otpErr && data.user) {
            setUserEmail(data.user.email || null);
          }
        } else if (code) {
          const { data, error: codeErr } = await supabase.auth.exchangeCodeForSession(code);
          if (!codeErr && data.user) {
            setUserEmail(data.user.email || null);
          }
        }

        // 3. Fallback: Check existing session
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setUserEmail(user.email || null);
        }
      } catch (err) {
        console.warn('[Auth] Initialization error:', err);
      } finally {
        setIsVerifying(false);
      }
    }

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user) {
        setUserEmail(session.user.email || null);
      }
    });

    initInviteAuth();

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (password.length < 12) {
      setErrorMsg('Password must be at least 12 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      // 1. Verify / recover active session if needed
      let { data: { user } } = await supabase.auth.getUser();

      if (!user && typeof window !== 'undefined' && window.location.hash.includes('access_token')) {
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const access_token = hashParams.get('access_token');
        const refresh_token = hashParams.get('refresh_token');

        if (access_token && refresh_token) {
          const { data } = await supabase.auth.setSession({ access_token, refresh_token });
          user = data.user;
        }
      }

      if (!user) {
        throw new Error('Your invitation session has expired or is invalid. Please request a new invite link.');
      }

      // 2. Update the user password
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        throw new Error(updateError.message);
      }

      // 3. Redirect to dashboard/onboarding
      window.location.href = '/';
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set password. Please try again.';
      setErrorMsg(msg);
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 bg-surface-muted">
      <div className="w-full max-w-md rounded-2xl bg-surface-bg p-8 shadow-sm border border-border-default space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-brand-primary text-white font-bold text-lg mb-1">
            ID
          </div>
          <h1 className="text-xl font-bold text-text-primary">Welcome to InternDocs</h1>
          <p className="text-xs text-text-muted">
            {userEmail ? (
              <>Setting up account for <span className="font-semibold text-text-primary">{userEmail}</span></>
            ) : (
              'Set your password to activate your account.'
            )}
          </p>
        </div>

        {errorMsg && (
          <div className="rounded-xl bg-rose-50 p-3.5 text-xs text-rose-800 border border-rose-200">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5" htmlFor="password">
              New Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={12}
              required
              placeholder="Minimum 12 characters"
              className="w-full rounded-xl border border-border-default p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
            <p className="mt-1 text-[11px] text-text-muted">Must be at least 12 characters long.</p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-text-primary mb-1.5" htmlFor="confirmPassword">
              Confirm Password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={12}
              required
              placeholder="Re-enter your password"
              className="w-full rounded-xl border border-border-default p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            />
          </div>

          <button
            type="submit"
            disabled={loading || isVerifying}
            className="w-full rounded-xl bg-brand-primary py-2.5 text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50 transition-colors shadow-xs"
          >
            {loading ? 'Activating Account...' : isVerifying ? 'Verifying Invite...' : 'Set Password & Enter Portal'}
          </button>
        </form>
      </div>
    </div>
  );
}
