import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { headers } from 'next/headers';

/**
 * FR-25 (G5): privacy notice must be shown and acknowledged at first login,
 * acknowledgement recorded. See src/app/privacy-notice/page.tsx for the gate
 * that calls these, wired into every role layout.
 */

export async function getPrivacyAcknowledgmentStatus(): Promise<{ acknowledged: boolean }> {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data } = await supabase
    .from('users')
    .select('privacy_acknowledged_at')
    .eq('id', user.id)
    .single();

  return { acknowledged: !!data?.privacy_acknowledged_at };
}

export async function acknowledgePrivacyNotice() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('users')
    .update({ privacy_acknowledged_at: now })
    .eq('id', user.id);

  if (updateError) throw new Error(`Failed to record privacy notice acknowledgment: ${updateError.message}`);

  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'PRIVACY_NOTICE_ACKNOWLEDGED',
    target_id: user.id,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}
