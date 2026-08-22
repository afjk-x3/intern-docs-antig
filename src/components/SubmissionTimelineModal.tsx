'use client';

import React, { useEffect, useState } from 'react';
import type { SubmissionWithRelations } from '../../lib/data/submissions';
import { fetchSubmissionTimelineAction, fetchSubmissionDetailsAction } from '../app/actions/submissions';

interface TimelineEvent {
  id: string;
  action: string;
  created_at: string;
  actor_id: string | null;
  users?: { email: string; role: string } | null;
}

interface SubmissionTimelineModalProps {
  submissionId: string;
  onClose: () => void;
}

export function SubmissionTimelineModal({ submissionId, onClose }: SubmissionTimelineModalProps) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [submission, setSubmission] = useState<SubmissionWithRelations | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        setIsLoading(true);
        const [timelineData, subDetails] = await Promise.all([
          fetchSubmissionTimelineAction(submissionId),
          fetchSubmissionDetailsAction(submissionId)
        ]);
        // TypeScript workaround for select() return types
        setEvents(timelineData as unknown as TimelineEvent[]);
        setSubmission(subDetails);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Failed to load timeline');
      } finally {
        setIsLoading(false);
      }
    }
    load();
  }, [submissionId]);

  const totalSteps = submission?.requirements?.routing_templates?.steps?.length || 1;
  const currentStep = submission?.current_step || 1;

  const getActionDescription = (action: string) => {
    const lookup: Record<string, string> = {
      SUBMIT_DOCUMENT: 'Document Submitted',
      RESUBMIT_DOCUMENT: 'Document Re-submitted',
      APPROVE_STEP: 'Step Approved',
      APPROVE_FINAL: 'Final Approval Granted',
      RETURN_DOCUMENT: 'Document Returned for Revision',
      REASSIGN_APPROVER: 'Approver Reassigned',
    };
    return lookup[action] || action;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg max-h-[85vh] flex flex-col rounded-2xl bg-surface-bg shadow-xl border border-border-default animate-in fade-in zoom-in-95 duration-150">
        
        <div className="p-6 border-b border-border-default flex justify-between items-start shrink-0">
          <div>
            <h3 className="text-lg font-bold text-text-primary">Submission Timeline</h3>
            {submission && (
              <p className="text-xs text-text-muted mt-1">
                {submission.requirements?.name}
              </p>
            )}
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-text-muted">
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
            </div>
          ) : error ? (
            <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
              {error}
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary Section */}
              <div className="bg-surface-muted p-4 rounded-xl border border-border-default text-sm">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-text-muted">Current State</span>
                    <span className="font-bold text-text-primary">{submission?.state}</span>
                  </div>
                  {submission?.state === 'IN_REVIEW' && (
                    <>
                      <div>
                        <span className="block text-xs font-semibold text-text-muted">Progress</span>
                        <span className="font-bold text-text-primary">Step {currentStep} of {totalSteps}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Timeline Events */}
              <div className="relative border-l border-slate-200 ml-3 space-y-6">
                {events.map((ev) => (
                  <div key={ev.id} className="relative pl-6">
                    <div className="absolute -left-1.5 top-1.5 h-3 w-3 rounded-full bg-slate-300 border-2 border-white" />
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-text-primary">
                        {getActionDescription(ev.action)}
                      </span>
                      <span className="text-xs text-text-muted">
                        {new Date(ev.created_at).toLocaleString()}
                      </span>
                      {ev.users && (
                        <span className="text-[11px] text-slate-500 mt-0.5">
                          by {ev.users.email} ({ev.users.role})
                        </span>
                      )}
                    </div>
                  </div>
                ))}
                {events.length === 0 && (
                  <div className="text-xs text-text-muted italic pl-4">No events recorded.</div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
