import { createAdminClient } from '../supabase/admin';
import { sendEmailWithRetry } from '../email/resend';
import { emailTemplates } from '../email/templates';
import { SubmissionState } from '../state-machine';

/**
 * Retention sweep job.
 * Runs daily to:
 * 1. Send warnings for items approaching their deletion date (14, 7, 1 days).
 * 2. Delete file bytes from storage for items past their deletion date IF warnings were sent.
 */
export async function runRetentionSweep() {
  const adminClient = createAdminClient();
  const now = new Date();

  // 1. Fetch all submissions that are not yet PURGED
  const { data: submissions, error } = await adminClient
    .from('submissions')
    .select(`
      id,
      intern_id,
      state,
      requirements(name),
      users!submissions_intern_id_fkey(email, internship_end),
      submission_versions(id, file_url, file_hash, is_superseded, deleted_at),
      approvals(created_at)
    `)
    .neq('state', 'PURGED');

  if (error || !submissions) {
    console.error('Failed to fetch submissions for retention sweep:', error);
    return;
  }

  // 2. Fetch past notifications to verify warning constraints (FR-17)
  const { data: pastNotifications } = await adminClient
    .from('notifications')
    .select('payload')
    .in('event_type', ['RETENTION_WARNING_14D', 'RETENTION_WARNING_7D', 'RETENTION_WARNING_1D']);

  const warningRecords = pastNotifications || [];

  for (const sub of submissions) {
    // Determine deletion date
    let deletionDate: Date | null = null;

    if (sub.state === SubmissionState.APPROVED) {
      // 30 days after approval
      const latestApproval = sub.approvals?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (latestApproval) {
        deletionDate = new Date(latestApproval.created_at);
        deletionDate.setDate(deletionDate.getDate() + 30);
      }
    } else {
      // 30 days after internship end for non-approved items
      // @ts-ignore
      const internshipEnd = sub.users?.internship_end;
      if (internshipEnd) {
        deletionDate = new Date(internshipEnd);
        deletionDate.setDate(deletionDate.getDate() + 30);
      }
    }

    if (!deletionDate) continue;

    const diffDays = Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    // @ts-ignore
    const internEmail = sub.users?.email;
    // @ts-ignore
    const reqName = sub.requirements?.name || 'Document';

    // Send warnings if exact day match and not already sent
    if ([14, 7, 1].includes(diffDays)) {
      const eventType = `RETENTION_WARNING_${diffDays}D`;
      const alreadySent = warningRecords.some(n => n.payload?.submission_id === sub.id && n.payload?.warning_days === diffDays);
      
      if (!alreadySent && internEmail) {
        const { success } = await sendEmailWithRetry(
          internEmail,
          `Action Required: Document Deletion in ${diffDays} Days`,
          emailTemplates.deletionWarning(reqName, diffDays)
        );

        if (success) {
          await adminClient.from('notifications').insert({
            user_id: sub.intern_id,
            event_type: eventType,
            payload: { submission_id: sub.id, warning_days: diffDays }
          });
        }
      }
    }

    // Process deletion if past date
    if (diffDays <= 0) {
      // Constraints check: Must have sent warnings before deletion (safety net)
      // We check if at least one warning (14d, 7d, or 1d) was recorded in notifications
      const hasWarnings = warningRecords.some(n => n.payload?.submission_id === sub.id);
      
      if (!hasWarnings) {
        console.warn(`Skipping deletion for sub ${sub.id}: No retention warnings were recorded.`);
        continue;
      }

      const activeVersion = sub.submission_versions?.find(v => !v.is_superseded) || sub.submission_versions?.[0];
      
      if (activeVersion && !activeVersion.deleted_at) {
        // Delete file bytes from storage
        const { error: storageErr } = await adminClient.storage
          .from('submissions')
          .remove([activeVersion.file_url]);

        if (storageErr) {
          console.error(`Storage deletion failed for ${sub.id}:`, storageErr.message);
          continue;
        }

        // Update version to set deleted_at
        const deletedAt = new Date().toISOString();
        await adminClient
          .from('submission_versions')
          .update({ deleted_at: deletedAt })
          .eq('id', activeVersion.id);

        // Update submission state to PURGED
        await adminClient
          .from('submissions')
          .update({ state: 'PURGED' })
          .eq('id', sub.id);

        // Insert audit log
        await adminClient.from('audit_log').insert({
          actor_id: null,
          action: 'RETENTION_PURGE_EXECUTED',
          target_id: sub.id,
          target_type: 'submissions',
          source_ip: '127.0.0.1',
          payload: { file_hash: activeVersion.file_hash, deleted_at: deletedAt }
        });

        console.log(`Successfully purged submission ${sub.id}`);
      }
    }
  }

  console.log('Retention sweep completed.');
}
