'use client';

import React, { useState } from 'react';
import { SignaturePad } from './SignaturePad';

interface AdminSignatureOverlayProps {
  hasSignature: boolean;
  signaturePreviewUrl?: string | null;
  lastUpdatedAt?: string | null;
  onSaveSignatureAction: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
}

export function AdminSignatureOverlay({
  hasSignature,
  signaturePreviewUrl,
  lastUpdatedAt,
  onSaveSignatureAction,
}: AdminSignatureOverlayProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Top Right Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold shadow-xs transition-all ${
          hasSignature
            ? 'bg-white border border-border-default text-text-primary hover:bg-slate-50 hover:border-slate-300'
            : 'bg-amber-50 border border-amber-300 text-amber-900 hover:bg-amber-100 font-bold'
        }`}
        title="View or update your digital signature stamp"
      >
        {hasSignature ? (
          <>
            <span className="flex h-2 w-2 relative">
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
            </svg>
            <span>My Signature</span>
          </>
        ) : (
          <>
            <span className="text-amber-600 text-sm">⚠️</span>
            <span>Enroll Signature</span>
          </>
        )}
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setIsOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-surface-bg rounded-2xl shadow-2xl border border-border-default w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-border-default bg-slate-50/50">
              <div className="flex items-center gap-2.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold ${hasSignature ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                  {hasSignature ? '✓' : '✍️'}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text-primary">Admin Digital Signature</h3>
                  <p className="text-[11px] text-text-muted">
                    This signature stamp will be composited onto approved documents.
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors"
                aria-label="Close modal"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[80vh] overflow-y-auto">
              <SignaturePad
                currentSignatureUrl={signaturePreviewUrl}
                lastUpdatedAt={lastUpdatedAt}
                onSaveSignature={async (formData) => {
                  const res = await onSaveSignatureAction(formData);
                  if (res.success) {
                    setIsOpen(false);
                  }
                  return res;
                }}
              />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
