import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * FR-24 lists the events the audit log must hold. Three were missing:
 *
 *   - "login"            -- only LOGIN_FAILED was written, so the log could show who failed
 *                           to get in but never who actually did.
 *   - "download"         -- getSubmissionSignedDownloadUrl logged only the tamper path, so a
 *                           successful retrieval left no record (also breaks FR-17's
 *                           "Every download is audit-logged").
 *   - "permission denial" -- refused access threw with no trace at all; only illegal state
 *                           transitions (DENIED_TRANSITION) were captured.
 */

type AuditRow = Record<string, unknown>;

// The parameter exists only so `mock.calls[0][0]` stays typed under `tsc --noEmit`.
/* eslint-disable-next-line @typescript-eslint/no-unused-vars */
const auditInsert = vi.fn(async (_row: AuditRow) => ({ error: null }));

vi.mock('next/headers', () => ({
  headers: async () => new Map([['x-forwarded-for', '203.0.113.7']]),
}));

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: () => ({ insert: auditInsert }),
  }),
}));

import { logPermissionDenied } from '../lib/data/audit';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('logPermissionDenied — FR-24 "permission denial"', () => {
  it('writes a PERMISSION_DENIED entry carrying actor, target and what was attempted', async () => {
    await logPermissionDenied({
      actorId: 'intern-a',
      attempted: 'READ_SUBMISSION',
      targetType: 'submissions',
      targetId: 'sub-belonging-to-someone-else',
      reason: 'intern requested another intern\'s submission',
    });

    expect(auditInsert).toHaveBeenCalledTimes(1);
    const row = auditInsert.mock.calls[0][0];

    expect(row.action).toBe('PERMISSION_DENIED');
    expect(row.actor_id).toBe('intern-a');
    expect(row.target_id).toBe('sub-belonging-to-someone-else');
    expect(row.target_type).toBe('submissions');
    expect(row.source_ip).toBe('203.0.113.7');

    const payload = row.payload as Record<string, unknown>;
    expect(payload.attempted).toBe('READ_SUBMISSION');
    expect(payload.reason).toBe('intern requested another intern\'s submission');
  });

  it('omits reason from the payload when none is given', async () => {
    await logPermissionDenied({ actorId: 'u1', attempted: 'CREATE_REQUIREMENT', targetType: 'requirements' });

    const payload = auditInsert.mock.calls[0][0].payload as Record<string, unknown>;
    expect(payload.attempted).toBe('CREATE_REQUIREMENT');
    expect(payload).not.toHaveProperty('reason');
    expect(auditInsert.mock.calls[0][0].target_id).toBeNull();
  });

  it('never throws when the audit write itself fails -- a 403 must not become a 500', async () => {
    auditInsert.mockRejectedValueOnce(new Error('audit table unreachable'));

    await expect(
      logPermissionDenied({ actorId: 'u1', attempted: 'UPDATE_ROLE', targetType: 'users' })
    ).resolves.toBeUndefined();
  });
});
