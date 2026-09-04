'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { PendingRegistration } from '@lib/data/users';
import { useRouter } from 'next/navigation';

interface PendingRegistrationsModalProps {
  initialRegistrations: PendingRegistration[];
  onApproveAction: (userId: string) => Promise<{ success?: boolean; error?: string }>;
}

export function PendingRegistrationsModal({
  initialRegistrations,
  onApproveAction,
}: PendingRegistrationsModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [registrations, setRegistrations] = useState<PendingRegistration[]>(initialRegistrations);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );
  const router = useRouter();

  // Keep local state in sync when server props refresh
  React.useEffect(() => {
    setRegistrations(initialRegistrations);
  }, [initialRegistrations]);

  const handleApprove = async (userId: string) => {
    setApprovingId(userId);
    setFeedback(null);
    try {
      const res = await onApproveAction(userId);
      if (res.error) {
        setFeedback({ type: 'error', message: res.error });
      } else {
        setFeedback({
          type: 'success',
          message: 'Intern registration approved! Notification email sent via Resend.',
        });
        setRegistrations((prev) => prev.filter((r) => r.id !== userId));
        router.refresh();
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Approval failed';
      setFeedback({ type: 'error', message: msg });
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <>
      {/* Trigger Button with Badge */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition-all shadow-2xs hover:shadow-xs active:scale-[0.99]"
      >
        <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>Pending Registrations</span>
        <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-600 text-white">
          {registrations.length}
        </span>
      </button>

      {/* Floating Modal */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsOpen(false);
          }}
        >
          <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl border border-border-default overflow-hidden flex flex-col max-h-[85vh] animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-slate-50/70">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-base font-bold text-text-primary">Pending Intern Registrations</h2>
                  <p className="text-xs text-text-muted">
                    Review and admit self-registered interns to the cohort.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-text-muted hover:text-text-primary hover:bg-slate-200/60 transition-colors"
                aria-label="Close modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Notification alert banner inside modal */}
            {feedback && (
              <div
                role="alert"
                className={`mx-6 mt-4 rounded-xl p-3 text-xs border ${
                  feedback.type === 'success'
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border-rose-200'
                }`}
              >
                {feedback.message}
              </div>
            )}

            {/* Modal Body / Table */}
            <div className="flex-1 overflow-y-auto p-6">
              {registrations.length === 0 ? (
                <div className="text-center py-12 space-y-2">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <h3 className="text-sm font-semibold text-text-primary">No pending registrations</h3>
                  <p className="text-xs text-text-muted max-w-sm mx-auto">
                    All prospective intern registration requests have been reviewed and admitted.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border-default border border-border-default rounded-xl overflow-hidden">
                  {registrations.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors"
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-text-primary">{item.fullName}</span>
                          <span className="inline-flex items-center rounded-md bg-brand-primary/10 px-2 py-0.5 text-[11px] font-medium text-brand-primary">
                            Batch {item.batch}
                          </span>
                          <span className="text-xs text-text-muted">({item.email})</span>
                        </div>
                        <div className="flex items-center gap-4 text-xs text-text-muted flex-wrap">
                          <div>
                            <strong className="text-slate-700">School:</strong> {item.school}
                          </div>
                          <div>
                            <strong className="text-slate-700">OJT:</strong>{' '}
                            {item.internshipStart && item.internshipEnd
                              ? `${item.internshipStart} to ${item.internshipEnd}`
                              : 'Not specified'}
                          </div>
                        </div>
                      </div>

                      <div className="shrink-0 flex items-center gap-2">
                        <Button
                          size="sm"
                          disabled={approvingId === item.id}
                          onClick={() => handleApprove(item.id)}
                          className="rounded-xl px-4 py-2 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs"
                        >
                          {approvingId === item.id ? 'Admitting...' : 'Approve & Join Cohort'}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end px-6 py-3 border-t border-border-default bg-slate-50/50">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-text-secondary hover:text-text-primary transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
