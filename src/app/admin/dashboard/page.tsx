import { getAdminDashboardData } from '@lib/data/dashboard';
import { AdminDashboardMatrix } from '../../../components/AdminDashboardMatrix';

export default async function AdminDashboardPage() {
  const data = await getAdminDashboardData();

  return (
    <div className="py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Completion Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">Overview of intern submission progress across all requirements.</p>
        </div>
        
        <AdminDashboardMatrix data={data} />
      </div>
    </div>
  );
}
