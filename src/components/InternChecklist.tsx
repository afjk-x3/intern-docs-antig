'use client';

import React, { useState } from 'react';
import { StatusBadge } from './StatusBadge';
import { RequirementRecord, SubmissionVersionRecord, ApprovalRecord } from '@lib/data/submissions';

export interface ChecklistItem {
  requirement: RequirementRecord;
  submission: unknown;
  state: string;
  dueDate: string | null;
  daysRemaining: number | null;
  isOverdue: boolean;
  activeVersion: SubmissionVersionRecord | null;
  latestApproval: ApprovalRecord | null;
  versions: SubmissionVersionRecord[];
}

interface InternChecklistProps {
  items: ChecklistItem[];
  internEmail?: string;
  onUploadAction: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onResubmitAction: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
  onGetDownloadUrlAction?: (submissionId: string) => Promise<{ signedUrl?: string; error?: string; isVerified?: boolean; fileHash?: string }>;
}

export function InternChecklist({
  items,
  internEmail,
  onUploadAction,
  onResubmitAction,
  onGetDownloadUrlAction,
}: InternChecklistProps) {
  const [selectedItem, setSelectedItem] = useState<ChecklistItem | null>(null);
  const [modalMode, setModalMode] = useState<'upload' | 'resubmit' | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const openUploadModal = (item: ChecklistItem) => {
    setSelectedItem(item);
    setModalMode('upload');
    setSelectedFile(null);
    setUploadError(null);
  };

  const openResubmitModal = (item: ChecklistItem) => {
    setSelectedItem(item);
    setModalMode('resubmit');
    setSelectedFile(null);
    setUploadError(null);
  };

  const closeModal = () => {
    setSelectedItem(null);
    setModalMode(null);
    setSelectedFile(null);
    setUploadError(null);
  };

  const handleDownload = async (submissionId: string) => {
    if (!onGetDownloadUrlAction) return;
    try {
      const res = await onGetDownloadUrlAction(submissionId);
      if (res.error) throw new Error(res.error);
      if (res.signedUrl) {
        window.open(res.signedUrl, '_blank');
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Download failed';
      alert(`Download failed: ${msg}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      setUploadError(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !selectedFile) {
      setUploadError('Please select a file to upload.');
      return;
    }

    const formData = new FormData();
    formData.append('file', selectedFile);

    setIsUploading(true);
    setUploadError(null);

    try {
      let result;
      if (modalMode === 'upload') {
        formData.append('requirement_id', selectedItem.requirement.id);
        result = await onUploadAction(formData);
      } else {
        const sub = selectedItem.submission as { id?: string } | null;
        if (!sub?.id) throw new Error('Submission ID missing');
        formData.append('submission_id', sub.id);
        result = await onResubmitAction(formData);
      }

      if (result.error) {
        throw new Error(result.error);
      }

      closeModal();
      window.location.reload();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Upload failed.';
      setUploadError(msg);
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="w-full space-y-6">
      {/* Header Profile Summary */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-surface-bg p-6 rounded-xl border border-border-default shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-text-primary">Internship Document Checklist</h2>
          <p className="text-sm text-text-muted mt-1">
            {internEmail ? `Logged in as ${internEmail}` : 'Track your required submission progress.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-surface-muted text-text-muted border border-border-default">
            {items.filter((i) => i.state === 'APPROVED').length} / {items.length} Completed
          </span>
        </div>
      </div>

      {/* Checklist Grid */}
      <div className="grid gap-4">
        {items.map((item) => {
          const req = item.requirement;
          const activeVer = item.activeVersion;
          const latestAppr = item.latestApproval;
          const sub = item.submission as { id?: string } | null;

          return (
            <div
              key={req.id}
              className="bg-surface-bg rounded-xl border border-border-default p-5 shadow-xs transition-shadow hover:shadow-sm"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 flex-1">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-bold text-text-primary">{req.name}</h3>
                    <StatusBadge state={item.state} isOverdue={item.isOverdue} />
                  </div>
                  <p className="text-xs text-text-muted line-clamp-2">{req.description}</p>
                </div>

                {/* Right Action / Details */}
                <div className="flex items-center gap-3 self-end sm:self-center shrink-0">
                  {item.state === 'NOT_STARTED' && (
                    <button
                      onClick={() => openUploadModal(item)}
                      className="px-4 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover transition-colors"
                    >
                      Upload File
                    </button>
                  )}

                  {item.state === 'RETURNED' && (
                    <button
                      onClick={() => openResubmitModal(item)}
                      className="px-4 py-2 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 transition-colors"
                    >
                      Re-upload Revision
                    </button>
                  )}

                  {item.state === 'APPROVED' && sub?.id && (
                    <button
                      onClick={() => handleDownload(sub.id!)}
                      className="px-3.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 text-emerald-800 text-xs font-semibold hover:bg-emerald-100 transition-colors flex items-center gap-1.5"
                    >
                      <svg className="h-3.5 w-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Download Signed PDF
                    </button>
                  )}

                  {['SUBMITTED', 'IN_REVIEW'].includes(item.state) && sub?.id && (
                    <button
                      onClick={() => handleDownload(sub.id!)}
                      className="px-3 py-1.5 rounded-lg border border-border-default text-xs font-medium text-text-muted hover:text-text-primary hover:bg-slate-50 transition-colors"
                    >
                      View Submitted
                    </button>
                  )}
                </div>
              </div>

              {/* Due Date & SLA Metadata */}
              <div className="mt-4 pt-3 border-t border-border-default flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
                <div className="flex items-center gap-4">
                  <span>
                    <strong>Due:</strong>{' '}
                    {item.dueDate ? new Date(item.dueDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Flexible'}
                  </span>
                  {item.daysRemaining !== null && item.state !== 'APPROVED' && (
                    <span className={item.daysRemaining <= 3 ? 'text-rose-600 font-bold' : ''}>
                      ({item.daysRemaining < 0 ? `${Math.abs(item.daysRemaining)} days overdue` : `${item.daysRemaining} days remaining`})
                    </span>
                  )}
                  {activeVer && (
                    <span className="font-mono text-[11px] bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                      v{activeVer.version_number} • {activeVer.file_hash.substring(0, 8)}...
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-[11px]">
                    Accepts: {req.accepted_types.map((t) => t.replace('image/', '').replace('application/', '.')).join(', ')} (Max {req.max_size_mb} MB)
                  </span>
                </div>
              </div>

              {/* Return Comment Alert Box */}
              {item.state === 'RETURNED' && activeVer?.return_comment && (
                <div className="mt-3 rounded-lg bg-rose-50 p-3 text-xs border border-rose-200 text-rose-900">
                  <div className="flex items-center gap-1.5 font-bold mb-1">
                    <span>⚠️ Supervisor Return Feedback (v{activeVer.version_number}):</span>
                  </div>
                  <p className="pl-4 italic">&ldquo;{activeVer.return_comment}&rdquo;</p>
                </div>
              )}

              {/* Approved Attestation Banner */}
              {item.state === 'APPROVED' && latestAppr && (
                <div className="mt-3 rounded-lg bg-emerald-50/80 p-2.5 text-xs border border-emerald-200 text-emerald-900 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-emerald-700 font-bold">✓ Digitally Signed & Approved</span>
                    <span className="text-emerald-700 text-[11px]">
                      on {new Date(latestAppr.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                    </span>
                  </div>
                  <span className="text-[10px] font-mono text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded">
                    SHA-256: {latestAppr.file_hash.substring(0, 12)}...
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Upload / Re-upload Modal */}
      {selectedItem && modalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-2xl bg-surface-bg p-6 shadow-xl border border-border-default animate-in fade-in zoom-in-95 duration-150">
            <h3 className="text-lg font-bold text-text-primary">
              {modalMode === 'upload' ? `Submit ${selectedItem.requirement.name}` : `Re-upload Revision for ${selectedItem.requirement.name}`}
            </h3>
            <p className="text-xs text-text-muted mt-1">
              Select your document to submit. Accepted formats: {selectedItem.requirement.accepted_types.join(', ')} (Max {selectedItem.requirement.max_size_mb} MB).
            </p>

            {uploadError && (
              <div className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
                {uploadError}
              </div>
            )}

            <form onSubmit={handleSubmit} className="mt-4 space-y-4">
              <div className="border-2 border-dashed border-border-default hover:border-brand-primary rounded-xl p-6 text-center cursor-pointer transition-colors bg-surface-muted">
                <input
                  type="file"
                  id="file-upload"
                  onChange={handleFileChange}
                  accept={selectedItem.requirement.accepted_types.join(',')}
                  className="hidden"
                />
                <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center">
                  <svg className="h-10 w-10 text-text-muted mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-xs font-semibold text-text-primary">
                    {selectedFile ? selectedFile.name : 'Click to browse or drag file here'}
                  </span>
                  <span className="text-[11px] text-text-muted mt-1">
                    {selectedFile ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB` : `PDF, PNG, or JPEG up to ${selectedItem.requirement.max_size_mb} MB`}
                  </span>
                </label>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={closeModal}
                  disabled={isUploading}
                  className="px-4 py-2 rounded-lg text-xs font-semibold text-text-muted hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !selectedFile}
                  className="px-5 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50"
                >
                  {isUploading ? 'Uploading & Sealing...' : 'Upload & Submit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
