import { createAdminClient } from '../supabase/admin';
import { sendEmailWithRetry } from '../email/resend';
import { emailTemplates } from '../email/templates';

// Helper to count working days between two dates
function getWorkingDays(startDate: Date, endDate: Date): number {
  let count = 0;
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const dayOfWeek = current.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) { // 0 = Sunday, 6 = Saturday
      count++;
    }
    current.setDate(current.getDate() + 1);
  }
  return count;
}

export async function runDailyDigest() {
  const adminClient = createAdminClient();
  const now = new Date();

  // 1. Fetch all IN_REVIEW submissions
  const { data: submissions, error } = await adminClient
    .from('submissions')
    .select(`
      id,
      updated_at,
      created_at,
      current_step,
      current_holder_id,
      requirements(id, name, routing_templates(sla_days)),
      users!submissions_intern_id_fkey(email)
    `)
    .eq('state', 'IN_REVIEW');

  if (error || !submissions) {
    console.error('Failed to fetch submissions for digest:', error);
    return;
  }

  const approverReminders = new Map<string, number>(); // approver_id -> count
  const adminEscalations: { internEmail: string; reqName: string }[] = [];

  for (const sub of submissions) {
    const lastUpdate = new Date(sub.updated_at || sub.created_at);
    const waitingDays = getWorkingDays(lastUpdate, now);
    
    // Default SLA is 2 days if not specified in routing template
    // @ts-expect-error nested field mapping
    const sla = sub.routing_snapshot?.sla_days || sub.requirements?.routing_templates?.sla_days || 2;

    if (waitingDays > sla) {
      if (sub.current_holder_id) {
        const count = approverReminders.get(sub.current_holder_id) || 0;
        approverReminders.set(sub.current_holder_id, count + 1);
      }
      
      if (waitingDays > sla + 5) {
        adminEscalations.push({
          // @ts-expect-error nested field mapping
          internEmail: sub.users?.email || 'Unknown',
          // @ts-expect-error nested field mapping
          reqName: sub.requirements?.name || 'Document',
        });
      }
    }
  }

  // 2. Send approver digest emails
  for (const [approverId, count] of approverReminders.entries()) {
    const { data: approver } = await adminClient.from('users').select('email').eq('id', approverId).single();
    if (approver?.email) {
      await sendEmailWithRetry(
        approver.email,
        'Daily Reminder: Pending Submissions',
        emailTemplates.dailyReminderApprover(count)
      );
    }
  }

  // 3. Send admin escalations
  if (adminEscalations.length > 0) {
    const { data: admins } = await adminClient.from('users').select('email').in('role', ['admin', 'system_admin']);
    const adminEmails = admins?.map(a => a.email) || [];
    
    for (const esc of adminEscalations) {
      for (const email of adminEmails) {
        await sendEmailWithRetry(
          email,
          `Admin Escalation: ${esc.reqName}`,
          emailTemplates.dailyReminderAdmin(esc.internEmail, esc.reqName)
        );
      }
    }
  }

  console.log(`Daily digest complete. Sent ${approverReminders.size} approver reminders and ${adminEscalations.length} escalations.`);
}
