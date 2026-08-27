'use client';

import React, { useState } from 'react';
import { ConfirmAction } from '@/components/ConfirmAction';
import { Button } from '@/components/ui/button';

interface RunRetentionSweepButtonProps {
  onRunSweepAction: () => Promise<{ success?: boolean; error?: string }>;
}

export function RunRetentionSweepButton({ onRunSweepAction }: RunRetentionSweepButtonProps) {
  const [open, setOpen] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConfirm = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const res = await onRunSweepAction();
      if (res.error) throw new Error(res.error);
      setOpen(false);
      window.location.reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Retention sweep failed.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => {
          setError(null);
          setOpen(true);
        }}
      >
        ⚡ Run Retention Sweep Now
      </Button>

      <ConfirmAction
        open={open}
        onOpenChange={(next) => {
          if (!isRunning) setOpen(next);
        }}
        title="Run retention sweep now?"
        description="This permanently deletes file bytes for every submission that has passed its 30-day retention window and already received its FR-17 deletion warnings. Submission records, approval records, hashes, and audit entries are not affected and are retained per FR-23 -- only the file bytes are removed. This cannot be undone."
        confirmLabel="Run Sweep"
        variant="destructive"
        isLoading={isRunning}
        loadingLabel="Running sweep…"
        error={error}
        onConfirm={handleConfirm}
        typedConfirmation={{ requiredText: 'PURGE' }}
      />
    </>
  );
}
