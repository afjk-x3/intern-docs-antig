export default function RetentionPage() {
  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Retention & Deletions</h1>
        <p className="text-sm text-text-muted mt-1">View records of purged submissions.</p>
      </div>
      <div className="bg-surface-bg p-6 rounded-xl border border-border-default flex items-center justify-center min-h-[300px]">
        <p className="text-text-muted text-sm">Post-deletion records can be viewed by visiting a purged submission's direct link.</p>
      </div>
    </div>
  );
}
