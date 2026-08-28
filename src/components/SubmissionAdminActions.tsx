'use client';

import React, { useState } from 'react';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Button } from '@/components/ui/button';

interface SubmissionAdminActionsProps {
  state: string;
  onCancelAction: (reason: string) => Promise<{ success?: boolean; error?: string }>;
  onReopenAction: () => Promise<{ success?: boolean; error?: string }>;
}

/**
 * Appendix A actions that had no UI before this: CANCEL (DRAFT/RETURNED, admin-only)
 * and REOPEN (EXPIRED -> IN_REVIEW, admin-only). See docs/09-project-audit.md,
 * 2026-08-28 audit, gap #21.
 */
export function SubmissionAdminActions({ state, onCancelAction, onReopenAction }: SubmissionAdminActionsProps) {
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reopenOpen, setReopenOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canCancel = state === 'DRAFT' || state === 'RETURNED';
  const canReopen = state === 'EXPIRED';

  if (!canCancel && !canReopen) return null;

  const handleConfirmCancel = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await onCancelAction(reason);
      if (res.error) throw new Error(res.error);
      setCancelOpen(false);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel submission');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmReopen = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await onReopenAction();
      if (res.error) throw new Error(res.error);
      setReopenOpen(false);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to reopen submission');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {canCancel && (
        <Button variant="destructive" size="sm" onClick={() => { setReason(''); setError(null); setCancelOpen(true); }}>
          Cancel Submission
        </Button>
      )}
      {canReopen && (
        <Button variant="outline" size="sm" onClick={() => { setError(null); setReopenOpen(true); }}>
          Reopen Submission
        </Button>
      )}

      <ConfirmAction
        open={cancelOpen}
        onOpenChange={setCancelOpen}
        title="Cancel this submission?"
        description="The intern is notified with your reason. This cannot be undone from the UI."
        confirmLabel="Cancel Submission"
        variant="destructive"
        isLoading={isLoading}
        loadingLabel="Cancelling…"
        confirmDisabled={reason.trim().length < 10}
        error={error}
        onConfirm={handleConfirmCancel}
      >
        <div>
          <label htmlFor="cancel-reason" className="block text-xs font-semibold text-text-primary mb-1.5">
            Reason (at least 10 characters)
          </label>
          <textarea
            id="cancel-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Why is this submission being cancelled?"
            className="w-full rounded-xl border border-border-default p-2.5 text-xs text-text-primary focus:border-brand-primary outline-none"
          />
        </div>
      </ConfirmAction>

      <ConfirmAction
        open={reopenOpen}
        onOpenChange={setReopenOpen}
        title="Reopen this submission?"
        description="It returns to In Review at the step it expired from. The intern is notified."
        confirmLabel="Reopen Submission"
        isLoading={isLoading}
        loadingLabel="Reopening…"
        error={error}
        onConfirm={handleConfirmReopen}
      />
    </div>
  );
}
