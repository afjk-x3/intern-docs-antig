export default function InternDashboard() {
  return (
    <div className="min-h-screen p-8 bg-surface-muted">
      <div className="max-w-2xl mx-auto bg-surface-bg p-6 rounded-lg shadow border border-border-default">
        <h1 className="text-2xl font-bold text-text-primary">Intern Dashboard</h1>
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-text-muted text-sm">No submissions yet. Your requirement checklist will appear here once configured by your administrator.</p>
        </div>
      </div>
    </div>
  );
}
