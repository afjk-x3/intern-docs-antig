'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { humanizeCode } from '@/lib/utils';

export interface RoleOption {
  value: string;
  label: string;
}

interface AdminInviteFormProps {
  onInviteAction: (formData: FormData) => Promise<{ success?: boolean; error?: string; inviteLink?: string | null }>;
  allowedRoles?: RoleOption[];
  /** Distinct school/batch values already in use, offered as autocomplete suggestions to keep group names consistent. */
  existingSchools?: string[];
  existingBatches?: string[];
}

export function AdminInviteForm({
  onInviteAction,
  allowedRoles = [
    { value: 'intern', label: 'Intern' },
    { value: 'approver', label: 'Approver' },
    { value: 'admin', label: 'Admin' },
  ],
  existingSchools = [],
  existingBatches = [],
}: AdminInviteFormProps) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState(allowedRoles[0]?.value || 'intern');
  const [school, setSchool] = useState('');
  const [batch, setBatch] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{ email: string; role: string; inviteLink?: string | null } | null>(null);
  const [copied, setCopied] = useState(false);

  const targetRole = allowedRoles.length === 1 ? allowedRoles[0].value : role;
  const isInternInvite = targetRole === 'intern';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessInfo(null);
    setCopied(false);

    const formData = new FormData();
    formData.set('email', email);
    formData.set('role', targetRole);
    if (isInternInvite) {
      formData.set('school', school.trim());
      formData.set('batch', batch.trim());
    }

    setIsSubmitting(true);
    try {
      const res = await onInviteAction(formData);
      if (res.error) throw new Error(res.error);

      setSuccessInfo({
        email,
        role: targetRole,
        inviteLink: res.inviteLink || null,
      });
      setEmail('');
      setSchool('');
      setBatch('');
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
    <div className="bg-surface-bg p-6 rounded-2xl shadow-xs border border-border-default space-y-4 max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-text-primary">
          {allowedRoles.length === 1 && allowedRoles[0]?.value === 'intern'
            ? 'Invite Cohort Intern'
            : 'Invite New User'}
        </h2>
        <p className="text-xs text-text-muted mt-0.5">
          {allowedRoles.length === 1 && allowedRoles[0]?.value === 'intern'
            ? 'Send an onboarding invitation link to a new intern in the cohort.'
            : 'Send an onboarding invitation with assigned organizational role.'}
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
          {errorMsg}
        </div>
      )}

      {successInfo && (
        <div role="status" className="rounded-xl bg-emerald-50 p-4 border border-emerald-200 space-y-2.5">
          <div className="flex items-center gap-1.5 text-emerald-800 font-bold text-xs">
            <svg className="h-3.5 w-3.5 shrink-0 text-status-approved" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>Invitation generated for {successInfo.email} ({humanizeCode(successInfo.role)})!</span>
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
                <Button type="button" size="sm" variant="success" onClick={handleCopyLink} className="shrink-0">
                  {copied ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div>
          <label htmlFor="invite-email" className="block text-xs font-semibold text-text-primary mb-1">Email Address</label>
          <input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="intern@makerspace.ph"
            className="w-full border border-border-default rounded-xl p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
          />
        </div>
        <div>
          <label htmlFor="invite-role" className="block text-xs font-semibold text-text-primary mb-1">Role</label>
          <select
            id="invite-role"
            value={role}
            disabled={allowedRoles.length <= 1}
            onChange={(e) => setRole(e.target.value)}
            className={`w-full border border-border-default rounded-xl p-2.5 text-xs text-text-primary outline-none ${
              allowedRoles.length <= 1
                ? 'bg-surface-hover text-text-muted cursor-not-allowed font-medium'
                : 'focus:ring-1 focus:ring-brand-primary focus:border-brand-primary'
            }`}
          >
            {allowedRoles.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
        </div>
        {isInternInvite && (
          <>
            <div>
              <label htmlFor="invite-school" className="block text-xs font-semibold text-text-primary mb-1">School <span className="font-normal text-text-muted">(optional)</span></label>
              <input
                id="invite-school"
                type="text"
                list="invite-school-options"
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                placeholder="e.g. De La Salle University"
                className="w-full border border-border-default rounded-xl p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
              />
              <datalist id="invite-school-options">
                {existingSchools.map((s) => <option key={s} value={s} />)}
              </datalist>
            </div>
            <div>
              <label htmlFor="invite-batch" className="block text-xs font-semibold text-text-primary mb-1">Batch <span className="font-normal text-text-muted">(optional)</span></label>
              <input
                id="invite-batch"
                type="text"
                list="invite-batch-options"
                value={batch}
                onChange={(e) => setBatch(e.target.value)}
                placeholder="e.g. Batch 2026-1"
                className="w-full border border-border-default rounded-xl p-2.5 text-xs text-text-primary placeholder:text-text-muted focus:ring-1 focus:ring-brand-primary focus:border-brand-primary outline-none"
              />
              <datalist id="invite-batch-options">
                {existingBatches.map((b) => <option key={b} value={b} />)}
              </datalist>
            </div>
          </>
        )}
        <div className="flex items-end">
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? 'Generating Invite...' : 'Send Invite'}
          </Button>
        </div>
      </form>
    </div>
  );
}
