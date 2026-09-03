import { NextResponse } from 'next/server';
import { runRetentionSweep } from '@lib/jobs/retention-sweep';

// FR-17 / FR-22: the 30-day retention sweep, invoked on a schedule via pg_cron + pg_net
// (see supabase/migrations/20240101000019_schedule_jobs.sql) rather than by any user
// action -- per 12-backend-security-rules.md #9, "Runs as a scheduled job... not
// triggered by user action." Authenticated by a shared secret, not a Supabase session:
// this is a system-to-system call, not a signed-in user.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await runRetentionSweep();
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Retention sweep failed';
    console.error('[Cron] Retention sweep failed:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
