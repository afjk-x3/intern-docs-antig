'use client';

import React, { useState } from 'react';

interface AdminInviteFormProps {
  onInviteAction: (formData: FormData) => Promise<{ success?: boolean; error?: string; inviteLink?: string | null }>;
}

export function AdminInviteForm({ onInviteAction }: AdminInviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('intern');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ email: string; role: string; inviteLink?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);
    setCopied(false);

    const formData = new FormData();
    formData.set('email', email);
    formData.set('role', role);

    setIsSubmitting(true);
    try {
      const res = await onInviteAction(formData);
      if (res.error) throw new Error(res.error);

      setSuccessInfo({
        email,
        role,
        inviteLink: res.inviteLink || null,
      });
      setEmail('');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send invitation';
      setErrorMsg(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCopyLink = () => {
    if (successInfo?.inviteLink) {
      navigator.clipboard.writeText(successInfo.inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  return (
    <div className="bg-surface-bg p-6 rounded-xl shadow-xs border border-border-default space-y-4">
      <div>
        <h2 className="text-base font-bold text-text-primary">Invite New User</h2>
        <p className="text-xs text-text-muted mt-0.5">
          Send an onboarding invitation with assigned role (Intern, Approver, or Admin).
        </p>
      </div>

      {errorMsg && (
        <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
          {errorMsg}
        </div>
      )}

      {successInfo && (
        <div className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 space-y-2.5">
          <div className="flex items-center gap-2 text-emerald-800 font-bold text-xs">
            <span>✓ Invitation generated for {successInfo.email} ({successInfo.role})!</span>
          </div>

          {successInfo.inviteLink && (
            <div className="space-y-1.5 pt-1">
              <span className="text-[11px] text-emerald-900 font-medium block">
                Direct Setup Link (Expires in 7 days):
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  readOnly
                  value={successInfo.inviteLink}
                  className="flex-1 bg-white border border-emerald-300 rounded-lg p-2 text-xs font-mono text-emerald-950 select-all outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopyLink}
                  className="shrink-0 px-3 py-2 rounded-lg bg-emerald-700 text-white text-xs font-semibold hover:bg-emerald-800 transition-colors"
                >
                  {copied ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Email Address</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="user@makerspace.ph"
            className="w-full border border-border-default rounded-lg p-2 text-xs text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-text-primary mb-1">Role</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full border border-border-default rounded-lg p-2 text-xs text-text-primary focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
          >
            <option value="intern">Intern</option>
            <option value="approver">Approver</option>
            <option value="admin">Admin</option>
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-brand-primary text-white py-2 px-4 rounded-lg text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50 transition-colors"
          >
            {isSubmitting ? 'Generating Invite...' : 'Send Invite'}
          </button>
        </div>
      </form>
    </div>
  );
}
