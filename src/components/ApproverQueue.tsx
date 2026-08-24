'use client';

import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { RequirementRecord, SubmissionVersionRecord } from '@lib/data/submissions';
import Link from 'next/link';
import { SubmissionTimelineModal } from './SubmissionTimelineModal';

export interface ApproverQueueItem {
  id: string;
  requirement_id: string;
  intern_id: string;
  state: string;
  current_step: number;
  current_holder_id: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
  isOverdue: boolean;
  waitingHours: number;
  users?: { id: string; email: string };
  requirements?: RequirementRecord | null;
  activeVersion: SubmissionVersionRecord | null;
}

export interface ApproverUser {
  id: string;
  email: string;
  role: string;
}

interface ApproverQueueProps {
  items: ApproverQueueItem[];
  approverEmail?: string;
  hasSignature: boolean;
  signaturePreviewUrl?: string | null;
  approversList?: ApproverUser[];
  onApproveAction: (submissionId: string) => Promise<{ success?: boolean; error?: string; final?: boolean; signedUrl?: string | null }>;
  onReturnAction: (submissionId: string, comment: string) => Promise<{ success?: boolean; error?: string }>;
  onReassignAction: (submissionId: string, newApproverId: string, reason: string) => Promise<{ success?: boolean; error?: string }>;
  onGetDownloadUrlAction: (submissionId: string) => Promise<{ signedUrl?: string; error?: string; isVerified?: boolean; fileHash?: string }>;
}

export function ApproverQueue({
  items,
  approverEmail,
  hasSignature,
  signaturePreviewUrl,
  approversList = [],
  onApproveAction,
  onReturnAction,
  onReassignAction,
  onGetDownloadUrlAction,
}: ApproverQueueProps) {
  const [selectedSub, setSelectedSub] = useState<ApproverQueueItem | null>(null);
  const [modalType, setModalType] = useState<'approve' | 'return' | 'reassign' | null>(null);
  const [returnComment, setReturnComment] = useState('');
  const [reassignApproverId, setReassignApproverId] = useState(approversList[0]?.id || '');
  const [reassignReason, setReassignReason] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [timelineSubId, setTimelineSubId] = useState<string | null>(null);

  const openApproveModal = (sub: ApproverQueueItem) => {
    setSelectedSub(sub);
    setModalType('approve');
    setActionError(null);
  };

  const openReturnModal = (sub: ApproverQueueItem) => {
    setSelectedSub(sub);
    setModalType('return');
    setReturnComment('');
    setActionError(null);
  };

  const openReassignModal = (sub: ApproverQueueItem) => {
    setSelectedSub(sub);
    setModalType('reassign');
    setReassignReason('');
    setReassignApproverId(approversList.find((a) => a.id !== sub.current_holder_id)?.id || approversList[0]?.id || '');
    setActionError(null);
  };

  const closeModal = () => {
    setSelectedSub(null);
    setModalType(null);
    setReturnComment('');
    setReassignReason('');
    setActionError(null);
  };

  const handleDownload = async (sub: ApproverQueueItem) => {
    try {
      const res = await onGetDownloadUrlAction(sub.id);
      if (res.error) throw new Error(res.error);
      if (res.signedUrl) {
        window.open(res.signedUrl, '_blank');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      alert(`Download failed: ${msg}`);
    }
  };

  const handleConfirmApprove = async () => {
    if (!selectedSub) return;
    if (!hasSignature) {
      setActionError('You must enroll a signature before you can approve.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const res = await onApproveAction(selectedSub.id);
      if (res.error) throw new Error(res.error);
      closeModal();
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Approval failed.';
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReturn = async () => {
    if (!selectedSub) return;
    if (returnComment.trim().length < 10) {
      setActionError('Return comment must be at least 10 characters long.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const res = await onReturnAction(selectedSub.id, returnComment);
      if (res.error) throw new Error(res.error);
      closeModal();
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Return failed.';
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!selectedSub) return;
    if (!reassignApproverId) {
      setActionError('Please select a target approver.');
      return;
    }
    if (reassignReason.trim().length < 10) {
      setActionError('Reassignment reason must be at least 10 characters long.');
      return;
    }

    setIsProcessing(true);
    setActionError(null);
    try {
      const res = await onReassignAction(selectedSub.id, reassignApproverId, reassignReason);
      if (res.error) throw new Error(res.error);
      closeModal();
      window.location.reload();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Reassignment failed.';
      setActionError(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-bg p-6 rounded-xl border border-border-default shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Approver Review Queue</h2>
          <p className="text-sm text-text-muted mt-1">
            {approverEmail ? `Logged in as ${approverEmail}` : 'Submissions pending your review.'}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-muted">Pending Review</span>
            <p className="text-lg font-bold text-amber-600">{items.length}</p>
          </div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="bg-surface-bg rounded-xl border border-border-default p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="text-base font-semibold text-text-primary">All caught up!</h3>
          <p className="text-sm text-text-muted mt-1">There are no submissions currently awaiting your review.</p>
        </div>
      ) : (
        <div className="bg-surface-bg rounded-xl border border-border-default shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface-muted border-b border-border-default text-xs uppercase font-semibold text-text-muted">
                <tr>
                  <th className="px-6 py-4">Intern / Submitter</th>
                  <th className="px-6 py-4">Requirement</th>
                  <th className="px-6 py-4">Version</th>
                  <th className="px-6 py-4">Wait Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-default">
                {items.map((sub) => {
                  const activeVer = sub.activeVersion;
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-text-primary">
                        {sub.users?.email || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 text-text-primary">
                        <div className="font-semibold">{sub.requirements?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="inline-block px-2 py-0.5 rounded text-xs font-mono bg-slate-100 text-slate-700 font-bold border border-slate-200">
                          v{activeVer?.version_number || 1}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-muted">
                        {sub.waitingHours < 24 ? (
                          <span>{sub.waitingHours} hours ago</span>
                        ) : (
                          <span>{Math.floor(sub.waitingHours / 24)} days ago</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <StatusBadge state={sub.state} isOverdue={sub.isOverdue} />
                      </td>
                      <td className="px-6 py-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleDownload(sub)}
                          className="px-2.5 py-1.5 rounded-lg border border-border-default text-xs font-semibold text-text-primary hover:bg-slate-100 transition-colors inline-flex items-center gap-1"
                          title="View / Download Document"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                          </svg>
                          View
                        </button>
                        <button
                          onClick={() => setTimelineSubId(sub.id)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                          title="View timeline history"
                        >
                          Timeline
                        </button>
                        <button
                          onClick={() => openReassignModal(sub)}
                          className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition-colors"
                          title="Reassign to another approver"
                        >
                          Reassign
                        </button>
                        <button
                          onClick={() => openReturnModal(sub)}
                          className="px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-xs font-semibold hover:bg-rose-100 transition-colors"
                        >
                          Return
                        </button>
                        <button
                          onClick={() => openApproveModal(sub)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 transition-colors inline-flex items-center gap-1.5"
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                          </svg>
                          Sign & Approve
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sign & Approve Confirmation Dialog with Signature Preview */}
      {selectedSub && modalType === 'approve' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-2 text-emerald-700 mb-1">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              <h3 className="text-lg font-bold text-text-primary">Sign & Approve Submission</h3>
            </div>

            <p className="text-xs text-text-muted mt-1">
              Applying your digital signature stamp to{' '}
              <strong className="text-text-primary">{selectedSub.users?.email}</strong>&apos;s submission.
            </p>

            <div className="mt-4 p-3 bg-surface-muted rounded-xl text-xs space-y-1.5 text-text-muted border border-border-default">
              <div><strong>Requirement:</strong> {selectedSub.requirements?.name}</div>
              <div><strong>Version:</strong> Version {selectedSub.activeVersion?.version_number}</div>
            </div>

            {/* Signature Stamp Preview */}
            <div className="mt-4 border border-dashed border-slate-300 rounded-xl p-3.5 bg-slate-50">
              <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
                Your Signature Stamp to be Applied:
              </span>
              {hasSignature && signaturePreviewUrl ? (
                <div className="h-20 flex items-center justify-center bg-white rounded-lg border border-slate-200 p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={signaturePreviewUrl}
                    alt="Your Enrolled Signature"
                    className="max-h-full max-w-full object-contain filter drop-shadow-xs"
                  />
                </div>
              ) : (
                <div className="text-center py-3 text-xs text-amber-700 bg-amber-50 rounded-lg p-2">
                  <span>⚠️ No signature enrolled. </span>
                  <Link href="/approver/signature" className="font-bold underline text-amber-900">
                    Enroll signature first
                  </Link>
                </div>
              )}
            </div>

            {actionError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmApprove}
                disabled={isProcessing || !hasSignature}
                className="px-5 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1.5"
              >
                {isProcessing ? 'Compositing & Stamping...' : 'Confirm & Apply Signature'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Return Dialog with Mandatory Comment (>= 10 chars) */}
      {selectedSub && modalType === 'return' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-text-primary">Return Submission for Revision</h3>
            <p className="text-xs text-text-muted mt-2">
              Explain why this document is being returned to the intern. A clear explanation is required so they know what to correct.
            </p>

            {actionError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="mt-4 space-y-2">
              <label className="block text-xs font-semibold text-text-primary">
                Return Comment (Minimum 10 characters):
              </label>
              <textarea
                value={returnComment}
                onChange={(e) => setReturnComment(e.target.value)}
                placeholder="e.g. Missing mentor signature on page 2. Please have it signed and re-upload."
                rows={4}
                className="w-full rounded-lg border border-border-default p-3 text-xs text-text-primary placeholder:text-text-muted focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
              />
              <div className="text-right text-[10px] text-text-muted">
                {returnComment.trim().length} / 10 characters minimum
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReturn}
                disabled={isProcessing || returnComment.trim().length < 10}
                className="px-5 py-2 rounded-lg bg-rose-600 text-white text-xs font-semibold hover:bg-rose-700 disabled:opacity-50"
              >
                {isProcessing ? 'Returning Document...' : 'Return Document'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Approver Reassignment Dialog (FR-15) */}
      {selectedSub && modalType === 'reassign' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-text-primary">Reassign Approver</h3>
            <p className="text-xs text-text-muted mt-2">
              Transfer this submission to a different approver. A mandatory reason is required and will be audit-logged.
            </p>

            {actionError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                {actionError}
              </div>
            )}

            <div className="mt-4 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Assign To:
                </label>
                <select
                  value={reassignApproverId}
                  onChange={(e) => setReassignApproverId(e.target.value)}
                  className="w-full rounded-lg border border-border-default p-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                >
                  {approversList
                    .filter((a) => a.email !== approverEmail)
                    .map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.email} ({a.role})
                      </option>
                    ))}
                </select>
                {approversList.filter((a) => a.email !== approverEmail).length === 0 && (
                  <p className="text-[11px] text-amber-600 mt-1">
                    No other approver accounts found. Add another approver in Admin &gt; Users.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-text-primary mb-1">
                  Reason for Reassignment (Min 10 characters):
                </label>
                <textarea
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Primary supervisor on official leave; reassigning to alternate approver."
                  rows={3}
                  className="w-full rounded-lg border border-border-default p-2 text-xs text-text-primary focus:border-brand-primary outline-none"
                />
                <div className="text-right text-[10px] text-text-muted">
                  {reassignReason.trim().length} / 10 characters minimum
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                type="button"
                onClick={closeModal}
                disabled={isProcessing}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:bg-slate-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReassign}
                disabled={isProcessing || reassignReason.trim().length < 10}
                className="px-5 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {isProcessing ? 'Reassigning...' : 'Confirm Reassignment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Timeline Modal */}
      {timelineSubId && (
        <SubmissionTimelineModal
          submissionId={timelineSubId}
          onClose={() => setTimelineSubId(null)}
        />
      )}
    </div>
  );
}
