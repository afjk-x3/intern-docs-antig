import { NextResponse } from 'next/server';
import { runDailyDigest } from '@lib/jobs/daily-digest';

// FR-19: the daily SLA reminder digest, invoked on a schedule via pg_cron + pg_net (see
// supabase/migrations/20240101000019_schedule_jobs.sql). Same shared-secret auth as the
// retention sweep route -- see that route's comment for why this isn't a Supabase session.
export async function POST(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  try {
    await runDailyDigest();
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Daily digest failed';
    console.error('[Cron] Daily digest failed:', msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
