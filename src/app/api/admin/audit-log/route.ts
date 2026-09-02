import { NextResponse } from 'next/server';
import { createClient } from '@lib/supabase/server';
import { createAdminClient } from '@lib/supabase/admin';
import { enrichAuditLogs } from '@lib/data/audit';

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return new NextResponse('Unauthorized', { status: 401 });

  const { data: dbUser } = await supabase.from('users').select('role').eq('id', user.id).single();
  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    return new NextResponse('Forbidden', { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const actorId = searchParams.get('actor_id');
  const targetId = searchParams.get('target_id');
  const limit = parseInt(searchParams.get('limit') || '100');

  const adminClient = createAdminClient();
  let query = adminClient
    .from('audit_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (actorId) {
    query = query.eq('actor_id', actorId);
  }
  if (targetId) {
    query = query.eq('target_id', targetId);
  }

  const { data, error } = await query;

  if (error) {
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }

  const dataWithEnrichment = await enrichAuditLogs(adminClient, data || []);

  return NextResponse.json(dataWithEnrichment);
}
