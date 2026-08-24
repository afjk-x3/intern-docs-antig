import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { z } from 'zod';
import { headers } from 'next/headers';

const datesSchema = z.object({
  start: z.string().date(),
  end: z.string().date(),
}).refine(data => new Date(data.end) > new Date(data.start), {
  message: "End date must be after start date",
}).refine(data => {
  const start = new Date(data.start);
  const end = new Date(data.end);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays <= 365;
}, {
  message: "Internship cannot exceed 12 months",
});

export async function updateInternshipDates(start: string, end: string, acknowledgePrivacy = true) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const parsed = datesSchema.parse({ start, end });

  // First approval check: editable until first approval
  const { data: myApprovals } = await supabase
    .from('submissions')
    .select('id, approvals(id)')
    .eq('intern_id', user.id);
    
  const hasApprovals = myApprovals?.some(sub => sub.approvals && sub.approvals.length > 0);
  if (hasApprovals) {
    throw new Error('Dates locked after first approval');
  }

  const now = new Date().toISOString();
  const updatePayload: Record<string, unknown> = {
    internship_start: parsed.start,
    internship_end: parsed.end,
  };

  if (acknowledgePrivacy) {
    updatePayload.privacy_acknowledged_at = now;
  }

  const { error: updateError } = await supabase
    .from('users')
    .update(updatePayload)
    .eq('id', user.id);

  if (updateError) throw new Error(updateError.message);

  const adminClient = createAdminClient();
  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert([
    {
      actor_id: user.id,
      action: 'UPDATE_INTERNSHIP_DATES',
      target_id: user.id,
      target_type: 'users',
      source_ip: ip,
    },
    ...(acknowledgePrivacy
      ? [
          {
            actor_id: user.id,
            action: 'PRIVACY_NOTICE_ACKNOWLEDGED',
            target_id: user.id,
            target_type: 'users',
            source_ip: ip,
          },
        ]
      : []),
  ]);

  return { success: true };
}

export async function updateUserRole(userId: string, newRole: string) {
  const supabase = await createClient();
  const { data: { user: currentUser }, error: authError } = await supabase.auth.getUser();
  if (authError || !currentUser) throw new Error('Not authenticated');

  const { data: currentDbUser, error: roleError } = await supabase
    .from('users')
    .select('role')
    .eq('id', currentUser.id)
    .single();

  if (roleError || !['admin', 'system_admin'].includes(currentDbUser?.role)) {
    throw new Error('Unauthorized');
  }

  const adminClient = createAdminClient();
  const { error: updateError } = await adminClient
    .from('users')
    .update({ role: newRole })
    .eq('id', userId);

  if (updateError) throw new Error(updateError.message);

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: currentUser.id,
    action: 'UPDATE_ROLE',
    target_id: userId,
    target_type: 'users',
    source_ip: ip,
  });

  return { success: true };
}
