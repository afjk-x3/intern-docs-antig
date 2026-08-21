export default function ApproverDashboard() {
  return (
    <div className="min-h-screen p-8 bg-surface-muted">
      <div className="max-w-2xl mx-auto bg-surface-bg p-6 rounded-lg shadow border border-border-default">
        <h1 className="text-2xl font-bold text-text-primary">Approver Dashboard</h1>
        <div className="mt-8 flex flex-col items-center justify-center py-12 text-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-text-muted mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
          <p className="text-text-muted text-sm">No submissions pending your review. Items assigned to you will appear here.</p>
        </div>
      </div>
    </div>
  );
}
