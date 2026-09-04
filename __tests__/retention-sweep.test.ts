import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * FR-22: "permanently deletes the stored files -- submitted versions and signed outputs".
 *
 * These tests exist because the sweep previously deleted only the single active
 * submission_version, leaving every signed PDF (approvals.signed_pdf_url) and every
 * superseded version in the bucket while still marking the submission PURGED and writing
 * a RETENTION_PURGE_EXECUTED audit entry -- i.e. reporting a deletion that had not fully
 * happened.
 */

type AuditRow = Record<string, unknown>;

// Arg types are declared so `mock.calls[0][0]` stays typed under `tsc --noEmit`; vitest
// itself does not typecheck, so an untyped vi.fn() passes the suite but fails the build.
// The parameters exist only to carry those types -- the mock bodies ignore them.
/* eslint-disable @typescript-eslint/no-unused-vars */
const storageRemove = vi.fn(async (_paths: string[]) => ({ data: [], error: null }));
const auditInsert = vi.fn(async (_row: AuditRow) => ({ error: null }));
const notificationsInsert = vi.fn(async (_row: AuditRow) => ({ error: null }));

const versionsUpdateIn = vi.fn(async (_column: string, _ids: string[]) => ({ error: null }));
const approvalsUpdateIn = vi.fn(async (_column: string, _ids: string[]) => ({ error: null }));
const submissionsUpdateEq = vi.fn(async (_column: string, _id: string) => ({ error: null }));

let submissionRows: unknown[] = [];

function makeQueryBuilder(table: string) {
  if (table === 'submissions') {
    const builder: Record<string, unknown> = {
      select: () => Promise.resolve({ data: submissionRows, error: null }),
      update: () => ({ eq: submissionsUpdateEq }),
    };
    return builder;
  }
  if (table === 'notifications') {
    return {
      select: () => ({ in: async () => ({ data: [{ payload: { submission_id: 'sub-1', warning_days: 7 } }], error: null }) }),
      insert: notificationsInsert,
    };
  }
  if (table === 'submission_versions') {
    return { update: () => ({ in: versionsUpdateIn }) };
  }
  if (table === 'approvals') {
    return { update: () => ({ in: approvalsUpdateIn }) };
  }
  if (table === 'audit_log') {
    return { insert: auditInsert };
  }
  throw new Error(`Unexpected table in test: ${table}`);
}

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: () => ({
    from: (table: string) => makeQueryBuilder(table),
    storage: { from: () => ({ remove: storageRemove }) },
  }),
}));

vi.mock('../lib/email/resend', () => ({
  sendEmailWithRetry: vi.fn(async () => ({ success: true })),
}));

import { runRetentionSweep } from '../lib/jobs/retention-sweep';

/** A submission 40 days past approval, so well past its 30-day deletion date. */
function approvedLongAgo() {
  const approvedAt = new Date();
  approvedAt.setDate(approvedAt.getDate() - 40);
  return approvedAt.toISOString();
}

beforeEach(() => {
  vi.clearAllMocks();
  submissionRows = [];
});

describe('runRetentionSweep — FR-22 file deletion coverage', () => {
  it('deletes superseded versions and signed outputs, not just the active version', async () => {
    submissionRows = [
      {
        id: 'sub-1',
        intern_id: 'intern-1',
        state: 'APPROVED',
        due_date: null,
        requirements: { name: 'DTR' },
        users: { email: 'intern@example.com', internship_end: '2020-01-01' },
        submission_versions: [
          { id: 'v1', file_url: 'intern-1/sub-1/v1.pdf', file_hash: 'hash-v1', is_superseded: true, deleted_at: null },
          { id: 'v2', file_url: 'intern-1/sub-1/v2.pdf', file_hash: 'hash-v2', is_superseded: false, deleted_at: null },
        ],
        approvals: [
          { id: 'a1', created_at: approvedLongAgo(), signed_pdf_url: 'intern-1/sub-1/signed-v2.pdf', deleted_at: null },
        ],
      },
    ];

    await runRetentionSweep();

    expect(storageRemove).toHaveBeenCalledTimes(1);
    const removedPaths = storageRemove.mock.calls[0][0];

    // The superseded version: previously left behind forever.
    expect(removedPaths).toContain('intern-1/sub-1/v1.pdf');
    // The active version: the only thing the old implementation removed.
    expect(removedPaths).toContain('intern-1/sub-1/v2.pdf');
    // The signed output carrying the approver's signature image.
    expect(removedPaths).toContain('intern-1/sub-1/signed-v2.pdf');
    expect(removedPaths).toHaveLength(3);
  });

  it('stamps deleted_at on both the versions and the approvals it removed', async () => {
    submissionRows = [
      {
        id: 'sub-1',
        intern_id: 'intern-1',
        state: 'APPROVED',
        due_date: null,
        requirements: { name: 'DTR' },
        users: { email: 'intern@example.com', internship_end: '2020-01-01' },
        submission_versions: [
          { id: 'v1', file_url: 'a.pdf', file_hash: 'h1', is_superseded: false, deleted_at: null },
        ],
        approvals: [
          { id: 'a1', created_at: approvedLongAgo(), signed_pdf_url: 'signed.pdf', deleted_at: null },
        ],
      },
    ];

    await runRetentionSweep();

    expect(versionsUpdateIn).toHaveBeenCalledWith('id', ['v1']);
    expect(approvalsUpdateIn).toHaveBeenCalledWith('id', ['a1']);
    expect(submissionsUpdateEq).toHaveBeenCalledWith('id', 'sub-1');
  });

  it('records how many versions and signed outputs were deleted in the audit payload', async () => {
    submissionRows = [
      {
        id: 'sub-1',
        intern_id: 'intern-1',
        state: 'APPROVED',
        due_date: null,
        requirements: { name: 'DTR' },
        users: { email: 'intern@example.com', internship_end: '2020-01-01' },
        submission_versions: [
          { id: 'v1', file_url: 'a.pdf', file_hash: 'h1', is_superseded: true, deleted_at: null },
          { id: 'v2', file_url: 'b.pdf', file_hash: 'h2', is_superseded: false, deleted_at: null },
        ],
        approvals: [
          { id: 'a1', created_at: approvedLongAgo(), signed_pdf_url: 's1.pdf', deleted_at: null },
        ],
      },
    ];

    await runRetentionSweep();

    const purgeEntry = auditInsert.mock.calls
      .map((c) => c[0])
      .find((e) => e.action === 'RETENTION_PURGE_EXECUTED');

    expect(purgeEntry).toBeDefined();
    const payload = purgeEntry!.payload as Record<string, unknown>;
    expect(payload.versions_deleted).toBe(2);
    expect(payload.signed_outputs_deleted).toBe(1);
    expect(payload.version_hashes).toEqual(['h1', 'h2']);
    expect(payload.deleted_at).toEqual(expect.any(String));
  });

  it('sweeps leftover bytes on an already-PURGED submission without re-running the state transition', async () => {
    // The exact shape the old implementation left behind: active version marked deleted,
    // superseded version and signed output still present in storage.
    submissionRows = [
      {
        id: 'sub-old',
        intern_id: 'intern-1',
        state: 'PURGED',
        due_date: null,
        requirements: { name: 'DTR' },
        users: { email: 'intern@example.com', internship_end: '2020-01-01' },
        submission_versions: [
          { id: 'v1', file_url: 'old-v1.pdf', file_hash: 'h1', is_superseded: true, deleted_at: null },
          { id: 'v2', file_url: 'old-v2.pdf', file_hash: 'h2', is_superseded: false, deleted_at: '2026-01-01T00:00:00Z' },
        ],
        approvals: [
          { id: 'a1', created_at: approvedLongAgo(), signed_pdf_url: 'old-signed.pdf', deleted_at: null },
        ],
      },
    ];

    await runRetentionSweep();

    const removedPaths = storageRemove.mock.calls[0][0];
    expect(removedPaths).toEqual(expect.arrayContaining(['old-v1.pdf', 'old-signed.pdf']));
    // Already-deleted version is not re-attempted.
    expect(removedPaths).not.toContain('old-v2.pdf');
    // No state write: it is already PURGED.
    expect(submissionsUpdateEq).not.toHaveBeenCalled();

    const entry = auditInsert.mock.calls
      .map((c) => c[0])
      .find((e) => e.action === 'RETENTION_PURGE_EXECUTED');
    expect((entry!.payload as Record<string, unknown>).leftover_sweep).toBe(true);
  });

  it('is idempotent: a fully-deleted purged submission triggers no storage call at all', async () => {
    submissionRows = [
      {
        id: 'sub-done',
        intern_id: 'intern-1',
        state: 'PURGED',
        due_date: null,
        requirements: { name: 'DTR' },
        users: { email: 'intern@example.com', internship_end: '2020-01-01' },
        submission_versions: [
          { id: 'v1', file_url: 'x.pdf', file_hash: 'h1', is_superseded: false, deleted_at: '2026-01-01T00:00:00Z' },
        ],
        approvals: [
          { id: 'a1', created_at: approvedLongAgo(), signed_pdf_url: 'sx.pdf', deleted_at: '2026-01-01T00:00:00Z' },
        ],
      },
    ];

    await runRetentionSweep();

    expect(storageRemove).not.toHaveBeenCalled();
    expect(auditInsert).not.toHaveBeenCalled();
  });

  it('does not delete anything when the required retention warnings were never sent', async () => {
    submissionRows = [
      {
        id: 'sub-no-warning', // notifications mock only records a warning for 'sub-1'
        intern_id: 'intern-1',
        state: 'APPROVED',
        due_date: null,
        requirements: { name: 'DTR' },
        users: { email: 'intern@example.com', internship_end: '2020-01-01' },
        submission_versions: [
          { id: 'v1', file_url: 'a.pdf', file_hash: 'h1', is_superseded: false, deleted_at: null },
        ],
        approvals: [
          { id: 'a1', created_at: approvedLongAgo(), signed_pdf_url: 's.pdf', deleted_at: null },
        ],
      },
    ];

    await runRetentionSweep();

    expect(storageRemove).not.toHaveBeenCalled();
  });
});
