import { NextResponse } from 'next/server';
import { createClient } from '@lib/supabase/server';
import { createAdminClient } from '@lib/supabase/admin';
import { getAdminDashboardData } from '@lib/data/dashboard';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const filterReq = searchParams.get('req') || 'ALL';
  const filterState = searchParams.get('state') || 'ALL';
  const filterApprover = searchParams.get('appr') || 'ALL';

  // Fetch data
  const data = await getAdminDashboardData();

  // Apply filters identically to client
  const filteredInterns = data.interns.filter(intern => {
    if (filterReq === 'ALL' && filterState === 'ALL' && filterApprover === 'ALL') return true;

    const internSubs = data.submissions.filter(s => s.intern_id === intern.id);
    
    let matches = false;
    if (internSubs.length === 0) {
      if (filterState === 'NOT_STARTED' && filterApprover === 'ALL') matches = true;
    } else {
      matches = internSubs.some(sub => {
        const matchReq = filterReq === 'ALL' || sub.requirement_id === filterReq;
        const matchState = filterState === 'ALL' || sub.state === filterState;
        const matchAppr = filterApprover === 'ALL' || sub.current_holder_email === filterApprover;
        return matchReq && matchState && matchAppr;
      });
      if (!matches && filterState === 'NOT_STARTED') {
         const hasSubForReq = internSubs.some(s => filterReq === 'ALL' ? false : s.requirement_id === filterReq);
         if (!hasSubForReq && filterApprover === 'ALL') matches = true;
      }
    }
    return matches;
  });

  const requirementsToRender = filterReq === 'ALL' 
    ? data.requirements 
    : data.requirements.filter(r => r.id === filterReq);

  // Generate CSV string
  let csv = 'Intern Email';
  requirementsToRender.forEach(req => {
    csv += `,${req.name.replace(/,/g, '')}`;
  });
  csv += '\n';

  filteredInterns.forEach(intern => {
    csv += `${intern.email}`;
    requirementsToRender.forEach(req => {
      const sub = data.submissions.find(s => s.intern_id === intern.id && s.requirement_id === req.id);
      const state = sub ? sub.state : 'NOT_STARTED';
      csv += `,${state}`;
    });
    csv += '\n';
  });

  // Audit log the export
  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'EXPORT_DASHBOARD_CSV',
    target_id: null,
    target_type: 'system',
    source_ip: ip,
    payload: { filterReq, filterState, filterApprover, resultCount: filteredInterns.length }
  });

  return new NextResponse(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="intern_export_${new Date().toISOString().split('T')[0]}.csv"`,
    },
  });
}
