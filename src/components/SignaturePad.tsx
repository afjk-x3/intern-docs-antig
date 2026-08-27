'use client';

import React, { useRef, useState, useEffect } from 'react';
import { ConfirmAction } from '@/components/ConfirmAction';

interface SignaturePadProps {
  currentSignatureUrl?: string | null;
  lastUpdatedAt?: string | null;
  onSaveSignature: (formData: FormData) => Promise<{ success?: boolean; error?: string }>;
}

export function SignaturePad({
  currentSignatureUrl,
  lastUpdatedAt,
  onSaveSignature,
}: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [mode, setMode] = useState<'canvas' | 'upload'>('canvas');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingPreviewUrl, setPendingPreviewUrl] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  // Revoke the object URL created for an uploaded-file preview once it's no longer needed.
  useEffect(() => {
    return () => {
      if (pendingPreviewUrl && mode === 'upload') URL.revokeObjectURL(pendingPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingPreviewUrl]);

  // Canvas drawing setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set high-DPI scaling
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();

    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    ctx.strokeStyle = '#0F172A';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
  }, [mode]);

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    setErrorMsg(null);

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = 'touches' in e ? e.touches[0].clientX - rect.left : e.clientX - rect.left;
    const y = 'touches' in e ? e.touches[0].clientY - rect.top : e.clientY - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setErrorMsg(null);
  };

  const handleFileUploadChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== 'image/png') {
        setErrorMsg('Please select a transparent PNG file.');
        setUploadFile(null);
        return;
      }
      if (file.size > 2 * 1024 * 1024) {
        setErrorMsg('File size must be under 2 MB.');
        setUploadFile(null);
        return;
      }
      setUploadFile(file);
      setErrorMsg(null);
    }
  };

  // Validates the captured signature and opens the confirm-with-preview dialog;
  // the actual save only happens from handleConfirmSave below.
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (mode === 'canvas') {
      const canvas = canvasRef.current;
      if (!canvas || !hasDrawn) {
        setErrorMsg('Please draw your signature before saving.');
        return;
      }
      setPendingPreviewUrl(canvas.toDataURL('image/png'));
    } else {
      if (!uploadFile) {
        setErrorMsg('Please choose a PNG signature file to upload.');
        return;
      }
      setPendingPreviewUrl(URL.createObjectURL(uploadFile));
    }

    setConfirmError(null);
    setConfirmOpen(true);
  };

  const handleConfirmSave = async () => {
    const formData = new FormData();

    if (mode === 'canvas') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      formData.set('signature_data', canvas.toDataURL('image/png'));
    } else {
      if (!uploadFile) return;
      formData.set('file', uploadFile);
    }

    setIsSaving(true);
    setConfirmError(null);
    try {
      const res = await onSaveSignature(formData);
      if (res.error) throw new Error(res.error);

      setConfirmOpen(false);
      setSuccessMsg('Signature enrolled successfully!');
      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save signature.';
      setConfirmError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Existing Enrolled Signature Card */}
      {currentSignatureUrl && (
        <div className="bg-surface-bg border border-border-default rounded-xl p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-text-primary">Currently Enrolled Signature</h3>
              <p className="text-xs text-text-muted">
                Last updated:{' '}
                {lastUpdatedAt
                  ? new Date(lastUpdatedAt).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                  : 'N/A'}
              </p>
            </div>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Active
            </span>
          </div>

          <div className="h-28 bg-slate-50 border border-dashed border-slate-200 rounded-lg flex items-center justify-center p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={currentSignatureUrl}
              alt="Enrolled Signature Preview"
              className="max-h-full max-w-full object-contain filter drop-shadow-xs"
            />
          </div>
        </div>
      )}

      {/* Signature Enrollment / Update Form */}
      <div className="bg-surface-bg border border-border-default rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between pb-4 border-b border-border-default mb-4">
          <div>
            <h3 className="text-base font-bold text-text-primary">
              {currentSignatureUrl ? 'Update Signature' : 'Enroll Digital Signature'}
            </h3>
            <p className="text-xs text-text-muted mt-0.5">
              Draw on screen or upload a transparent PNG (&lt; 2 MB). Stamped onto approved PDFs.
            </p>
          </div>

          {/* Mode Tabs */}
          <div role="tablist" aria-label="Signature input method" className="flex bg-surface-muted rounded-lg p-1 border border-border-default text-xs">
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'canvas'}
              onClick={() => { setMode('canvas'); setErrorMsg(null); }}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${mode === 'canvas' ? 'bg-surface-bg text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
                }`}
            >
              Draw
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'upload'}
              onClick={() => { setMode('upload'); setErrorMsg(null); }}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${mode === 'upload' ? 'bg-surface-bg text-brand-primary shadow-xs' : 'text-text-muted hover:text-text-primary'
                }`}
            >
              Upload PNG
            </button>
          </div>
        </div>

        {errorMsg && (
          <div role="alert" className="mb-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-800 border border-rose-200">
            {errorMsg}
          </div>
        )}

        {successMsg && (
          <div role="status" className="mb-4 rounded-lg bg-emerald-50 p-3 text-xs text-emerald-800 border border-emerald-200">
            {successMsg}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'canvas' ? (
            <div>
              <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden touch-none">
                <canvas
                  ref={canvasRef}
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                  className="w-full h-44 cursor-crosshair block"
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-xs text-slate-400 font-medium">
                    Sign here with your mouse, stylus, or finger
                  </div>
                )}
              </div>

              <div className="flex justify-between items-center mt-2">
                <span className="text-[11px] text-text-muted">
                  Make sure your signature is clear and centered.
                </span>
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1"
                >
                  Clear Canvas
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div className="border-2 border-dashed border-border-default hover:border-brand-primary rounded-xl p-6 text-center cursor-pointer transition-colors bg-surface-muted">
                <input
                  type="file"
                  id="sig-file"
                  accept="image/png"
                  onChange={handleFileUploadChange}
                  className="hidden"
                />
                <label htmlFor="sig-file" className="cursor-pointer flex flex-col items-center">
                  <svg className="h-10 w-10 text-brand-primary mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-xs font-semibold text-text-primary">
                    {uploadFile ? uploadFile.name : 'Click to select transparent PNG'}
                  </span>
                  <span className="text-[11px] text-text-muted mt-1">PNG format only (Max 2 MB)</span>
                </label>
              </div>
            </div>
          )}

          <div className="flex justify-end pt-3 border-t border-border-default">
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary-hover disabled:opacity-50 transition-colors flex items-center gap-2"
            >
              {currentSignatureUrl ? 'Update Signature' : 'Save Signature'}
            </button>
          </div>
        </form>
      </div>

      <ConfirmAction
        open={confirmOpen}
        onOpenChange={(next) => {
          if (isSaving) return;
          setConfirmOpen(next);
          if (!next && pendingPreviewUrl && mode === 'upload') {
            URL.revokeObjectURL(pendingPreviewUrl);
            setPendingPreviewUrl(null);
          }
        }}
        title={currentSignatureUrl ? 'Replace your enrolled signature?' : 'Save this signature?'}
        description={
          currentSignatureUrl
            ? 'This replaces the signature stamp used on every approval you sign from now on. Approvals you already signed keep their original stamp.'
            : 'This is the stamp that will be composited onto documents when you approve them.'
        }
        confirmLabel={currentSignatureUrl ? 'Replace Signature' : 'Save Signature'}
        isLoading={isSaving}
        loadingLabel="Saving…"
        error={confirmError}
        onConfirm={handleConfirmSave}
      >
        {pendingPreviewUrl && (
          <div>
            <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1.5">
              Preview -- approximate size as stamped on an approved document:
            </span>
            <div className="h-24 flex items-center justify-center bg-slate-50 rounded-lg border border-dashed border-slate-300 p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={pendingPreviewUrl}
                alt="Signature preview"
                className="max-h-full max-w-[220px] object-contain filter drop-shadow-xs"
              />
            </div>
          </div>
        )}
      </ConfirmAction>
    </div>
  );
}
