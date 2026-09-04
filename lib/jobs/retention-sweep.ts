import { createAdminClient } from '../supabase/admin';
import { sendEmailWithRetry } from '../email/resend';
import { emailTemplates } from '../email/templates';
import { SubmissionState, UserRole, validateTransition, IllegalTransitionError } from '../state-machine';

interface PurgeableVersion {
  id: string;
  file_url: string;
  file_hash: string;
  is_superseded: boolean;
  deleted_at: string | null;
}

interface PurgeableApproval {
  id: string;
  created_at: string;
  signed_pdf_url: string | null;
  deleted_at: string | null;
}

interface PurgeResult {
  deleted: boolean;
  deletedAt: string | null;
  versionPaths: string[];
  signedOutputPaths: string[];
  versionHashes: string[];
}

/**
 * Deletes every remaining file byte belonging to one submission and stamps deleted_at on
 * whatever it removed.
 *
 * FR-22 covers "submitted versions and signed outputs", so this deletes *all* versions --
 * superseded ones included, since each is a distinct stored object created by the
 * return/resubmit loop -- plus every approvals.signed_pdf_url. The previous implementation
 * removed only the single active version, which left signed PDFs (the ones actually
 * carrying an approver's signature image) and every prior revision in the bucket forever
 * while still marking the submission PURGED.
 *
 * Idempotent: rows already carrying deleted_at are skipped, so a submission purged by an
 * earlier run is not re-attempted daily, and a submission purged by the *old* buggy code
 * gets its leftover bytes swept on the next run.
 */
async function purgeSubmissionFiles(
  adminClient: ReturnType<typeof createAdminClient>,
  submissionId: string,
  versions: PurgeableVersion[],
  approvals: PurgeableApproval[]
): Promise<PurgeResult> {
  const versionsToDelete = versions.filter((v) => !v.deleted_at && v.file_url);
  const approvalsToDelete = approvals.filter((a) => !a.deleted_at && a.signed_pdf_url);

  const versionPaths = versionsToDelete.map((v) => v.file_url);
  const signedOutputPaths = approvalsToDelete.map((a) => a.signed_pdf_url as string);
  const allPaths = [...new Set([...versionPaths, ...signedOutputPaths])];

  if (allPaths.length === 0) {
    return { deleted: false, deletedAt: null, versionPaths: [], signedOutputPaths: [], versionHashes: [] };
  }

  const { error: storageErr } = await adminClient.storage.from('submissions').remove(allPaths);

  if (storageErr) {
    console.error(`Storage deletion failed for ${submissionId}:`, storageErr.message);
    return { deleted: false, deletedAt: null, versionPaths: [], signedOutputPaths: [], versionHashes: [] };
  }

  const deletedAt = new Date().toISOString();

  if (versionsToDelete.length > 0) {
    await adminClient
      .from('submission_versions')
      .update({ deleted_at: deletedAt })
      .in('id', versionsToDelete.map((v) => v.id));
  }

  if (approvalsToDelete.length > 0) {
    await adminClient
      .from('approvals')
      .update({ deleted_at: deletedAt })
      .in('id', approvalsToDelete.map((a) => a.id));
  }

  return {
    deleted: true,
    deletedAt,
    versionPaths,
    signedOutputPaths,
    versionHashes: versionsToDelete.map((v) => v.file_hash),
  };
}

/**
 * Retention sweep job.
 * Runs daily to:
 * 1. Expire stalled submissions past their due date (Appendix A: past due + grace -> EXPIRED),
 *    so they can later be purged the same way an EXPIRED/CANCELLED submission is.
 * 2. Send warnings for items approaching their deletion date (14, 7, 1 days).
 * 3. Delete file bytes from storage for items past their deletion date IF warnings were sent.
 * 4. Sweep up file bytes left behind on already-PURGED submissions by earlier runs that
 *    only ever deleted the active version (see purgeSubmissionFiles).
 *
 * Every state write goes through lib/state-machine (FR-13 / 12-backend-security-rules.md §5).
 * Per Appendix A, PURGE is only a legal transition from APPROVED, CANCELLED, or EXPIRED --
 * a submission still SUBMITTED/IN_REVIEW/RETURNED must first become EXPIRED before this job
 * will ever touch its file bytes.
 */
export async function runRetentionSweep() {
  const adminClient = createAdminClient();
  const now = new Date();

  // 1. Fetch every submission. PURGED ones are included deliberately: they are skipped for
  //    state changes but still checked for file bytes an earlier run left behind (FR-22).
  const { data: submissions, error } = await adminClient
    .from('submissions')
    .select(`
      id,
      intern_id,
      state,
      due_date,
      requirements(name),
      users!submissions_intern_id_fkey(email, internship_end),
      submission_versions(id, file_url, file_hash, is_superseded, deleted_at),
      approvals(id, created_at, signed_pdf_url, deleted_at)
    `);

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
    const currentState = sub.state as SubmissionState;
    const versions = (sub.submission_versions || []) as unknown as PurgeableVersion[];
    const subApprovals = (sub.approvals || []) as unknown as PurgeableApproval[];

    // Step 0: an already-PURGED submission needs no state change, but may still be holding
    // signed outputs or superseded versions that the pre-FR-22-fix sweep never removed.
    if (currentState === SubmissionState.PURGED) {
      const leftover = await purgeSubmissionFiles(adminClient, sub.id, versions, subApprovals);
      if (leftover.deleted) {
        await adminClient.from('audit_log').insert({
          actor_id: null,
          action: 'RETENTION_PURGE_EXECUTED',
          target_id: sub.id,
          target_type: 'submissions',
          source_ip: '127.0.0.1',
          payload: {
            deleted_at: leftover.deletedAt,
            version_hashes: leftover.versionHashes,
            versions_deleted: leftover.versionPaths.length,
            signed_outputs_deleted: leftover.signedOutputPaths.length,
            leftover_sweep: true,
          },
        });
        console.log(
          `Swept ${leftover.versionPaths.length} version(s) and ${leftover.signedOutputPaths.length} signed output(s) left behind on already-purged submission ${sub.id}`
        );
      }
      continue;
    }

    // Step A: expire stalled non-terminal submissions past their due date. A submission still
    // in this state is never eligible for purge below -- it must become EXPIRED first.
    const nonTerminal = [SubmissionState.SUBMITTED, SubmissionState.IN_REVIEW, SubmissionState.RETURNED];
    if (nonTerminal.includes(currentState)) {
      if (sub.due_date && new Date(sub.due_date).getTime() < now.getTime()) {
        try {
          validateTransition(currentState, 'EXPIRE', UserRole.SYSTEM_ADMIN);
          await adminClient
            .from('submissions')
            .update({ state: SubmissionState.EXPIRED, updated_at: now.toISOString() })
            .eq('id', sub.id);

          await adminClient.from('audit_log').insert({
            actor_id: null,
            action: 'SYSTEM_EXPIRE_SUBMISSION',
            target_id: sub.id,
            target_type: 'submissions',
            source_ip: '127.0.0.1',
          });
        } catch (err) {
          if (err instanceof IllegalTransitionError) {
            console.warn(`Retention sweep: illegal EXPIRE transition for ${sub.id}:`, err.message);
          } else {
            console.error(`Retention sweep: failed to expire ${sub.id}:`, err);
          }
        }
      }
      continue;
    }

    // Anything not APPROVED, CANCELLED, or EXPIRED here (e.g. DRAFT) has no legal PURGE
    // transition and is never eligible for deletion.
    const purgeable = [SubmissionState.APPROVED, SubmissionState.CANCELLED, SubmissionState.EXPIRED];
    if (!purgeable.includes(currentState)) continue;

    // Step B: compute deletion date for terminal states only
    let deletionDate: Date | null = null;

    if (currentState === SubmissionState.APPROVED) {
      // 30 days after approval
      const latestApproval = sub.approvals?.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      if (latestApproval) {
        deletionDate = new Date(latestApproval.created_at);
        deletionDate.setDate(deletionDate.getDate() + 30);
      }
    } else {
      // CANCELLED / EXPIRED: 30 days after internship end
      // @ts-expect-error nested field mapping
      const internshipEnd = sub.users?.internship_end;
      if (internshipEnd) {
        deletionDate = new Date(internshipEnd);
        deletionDate.setDate(deletionDate.getDate() + 30);
      }
    }

    if (!deletionDate) continue;

    const diffDays = Math.ceil((deletionDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // @ts-expect-error nested field mapping
    const internEmail = sub.users?.email;
    // @ts-expect-error nested field mapping
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

      const activeVersion = versions.find(v => !v.is_superseded) || versions[0];
      const hasBytesLeft =
        versions.some(v => !v.deleted_at && v.file_url) ||
        subApprovals.some(a => !a.deleted_at && a.signed_pdf_url);

      if (hasBytesLeft) {
        // Validated before any byte is removed -- deletion cannot be undone if the
        // transition turns out to be illegal.
        try {
          validateTransition(currentState, 'PURGE', UserRole.SYSTEM_ADMIN);
        } catch (err) {
          if (err instanceof IllegalTransitionError) {
            console.warn(`Retention sweep: illegal PURGE transition for ${sub.id}:`, err.message);
          }
          continue;
        }

        // Deletes every version (superseded included) and every signed output -- FR-22
        // covers "submitted versions and signed outputs", not just the active version.
        const purge = await purgeSubmissionFiles(adminClient, sub.id, versions, subApprovals);

        if (!purge.deleted) continue;

        // Update submission state to PURGED
        await adminClient
          .from('submissions')
          .update({ state: SubmissionState.PURGED })
          .eq('id', sub.id);

        // Insert audit log. file_hash stays for continuity with entries written before
        // this job deleted more than one file; version_hashes carries the full set.
        await adminClient.from('audit_log').insert({
          actor_id: null,
          action: 'RETENTION_PURGE_EXECUTED',
          target_id: sub.id,
          target_type: 'submissions',
          source_ip: '127.0.0.1',
          payload: {
            file_hash: activeVersion?.file_hash ?? null,
            deleted_at: purge.deletedAt,
            version_hashes: purge.versionHashes,
            versions_deleted: purge.versionPaths.length,
            signed_outputs_deleted: purge.signedOutputPaths.length,
          }
        });

        console.log(
          `Successfully purged submission ${sub.id} (${purge.versionPaths.length} version(s), ${purge.signedOutputPaths.length} signed output(s))`
        );
      }
    }
  }

  console.log('Retention sweep completed.');
}
