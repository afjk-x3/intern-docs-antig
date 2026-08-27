import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// __tests__/setup.ts globally mocks @supabase/supabase-js so the rest of the suite
// can unit-test lib/data/* without touching a real database. This file is the
// opposite: it needs the real client, talking to a real local Postgres instance,
// because RLS can only be proven by asking Postgres to enforce it. Vitest isolates
// modules per test file, so unmocking here does not affect any other test file.
vi.unmock('@supabase/supabase-js');

/**
 * Real, non-mocked RLS integration suite (FR-26, docs/05-security.md section 8).
 *
 * Runs against a live local Supabase/Postgres instance with the project's actual
 * migrations applied (`npx supabase start`, then `npx supabase db reset` if the
 * local DB predates the newest migration). It signs in as real users and lets
 * Postgres's row-level security decide what happens -- nothing here is told what
 * to return. This replaces the former rls-tables.test.ts / rls-users.test.ts,
 * which mocked the Supabase client's own responses and therefore could not have
 * caught a real RLS regression (see docs/09-project-audit.md, gap #13).
 *
 * Every one of the 7 mandated scenarios below failed against this exact suite at
 * least once during development: scenario 4 caught a live self-role-escalation
 * hole (fixed in migration 20240101000012_prevent_self_role_escalation.sql) that
 * every mock-based test and every prior audit pass had missed, because a mock
 * cannot enforce a real database constraint it was never told about.
 */

const SUPABASE_URL = process.env.TEST_SUPABASE_URL || 'http://127.0.0.1:54331';
// Standard Supabase CLI local-development demo keys -- identical and public across
// every `supabase start` instance everywhere; not a secret, never valid outside a
// local Docker instance.
const ANON_KEY = process.env.TEST_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0';
const SERVICE_ROLE_KEY = process.env.TEST_SUPABASE_SERVICE_ROLE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

const EVAL_PAPER_REQUIREMENT_ID = '11111111-1111-1111-1111-111111111111';
const TEST_PASSWORD = 'Sup3rSecretTestPassw0rd!!';

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type TestUser = { id: string; email: string; client: SupabaseClient };

async function createTestUser(role: 'intern' | 'approver' | 'admin'): Promise<TestUser> {
  const email = `fr26-${role}-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: TEST_PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) {
    throw new Error(`Fixture setup failed creating auth user: ${error?.message}`);
  }
  const { error: upsertErr } = await admin.from('users').upsert({ id: data.user.id, email, role });
  if (upsertErr) throw new Error(`Fixture setup failed creating public.users row: ${upsertErr.message}`);

  const client = createClient(SUPABASE_URL, ANON_KEY, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error: signInErr } = await client.auth.signInWithPassword({ email, password: TEST_PASSWORD });
  if (signInErr) throw new Error(`Fixture setup failed signing in test user: ${signInErr.message}`);

  return { id: data.user.id, email, client };
}

let internAlice: TestUser;
let internBob: TestUser;
let approverCarl: TestUser;
let approverDave: TestUser;
let adminErin: TestUser;

let heldSubmissionId: string;
let heldVersionId: string;
const heldSubmissionFilePath = () => `${internAlice.id}/${heldSubmissionId}/v1.pdf`;

let approvedSubmissionId: string;

const carlSignaturePath = () => `${approverCarl.id}/signature.png`;

beforeAll(async () => {
  const { error: reachErr } = await admin.from('requirements').select('id').limit(1);
  if (reachErr) {
    throw new Error(
      `Cannot reach local Supabase at ${SUPABASE_URL} (${reachErr.message}). ` +
      'This suite requires a live Postgres instance with RLS -- it does not run against mocks. ' +
      'Run `npx supabase start`, then `npx supabase db reset` if the DB predates the latest migration.'
    );
  }

  [internAlice, internBob, approverCarl, approverDave, adminErin] = await Promise.all([
    createTestUser('intern'),
    createTestUser('intern'),
    createTestUser('approver'),
    createTestUser('approver'),
    createTestUser('admin'),
  ]);

  // A submission at step 1 of a two-step routing, currently held by Carl.
  const { data: heldSub, error: heldSubErr } = await admin
    .from('submissions')
    .insert({
      intern_id: internAlice.id,
      requirement_id: EVAL_PAPER_REQUIREMENT_ID,
      state: 'IN_REVIEW',
      current_step: 1,
      current_holder_id: approverCarl.id,
      routing_snapshot: [
        { step: 1, role: 'approver', user_id: approverCarl.id },
        { step: 2, role: 'admin' },
      ],
    })
    .select('id')
    .single();
  if (heldSubErr || !heldSub) throw new Error(`Fixture setup failed creating held submission: ${heldSubErr?.message}`);
  heldSubmissionId = heldSub.id;

  const { data: heldVersion, error: heldVersionErr } = await admin
    .from('submission_versions')
    .insert({
      submission_id: heldSubmissionId,
      version_number: 1,
      file_url: heldSubmissionFilePath(),
      file_hash: 'a'.repeat(64),
    })
    .select('id')
    .single();
  if (heldVersionErr || !heldVersion) throw new Error(`Fixture setup failed creating submission version: ${heldVersionErr?.message}`);
  heldVersionId = heldVersion.id;

  const { error: uploadErr } = await admin.storage
    .from('submissions')
    .upload(heldSubmissionFilePath(), Buffer.from('%PDF-1.4 fixture content'), {
      contentType: 'application/pdf',
      upsert: true,
    });
  if (uploadErr) throw new Error(`Fixture setup failed uploading submission file: ${uploadErr.message}`);

  const { error: sigUploadErr } = await admin.storage
    .from('signatures')
    .upload(carlSignaturePath(), Buffer.from('\x89PNG fixture content'), {
      contentType: 'image/png',
      upsert: true,
    });
  if (sigUploadErr) throw new Error(`Fixture setup failed uploading signature file: ${sigUploadErr.message}`);

  // A fully approved submission, for the "edit an approved submission" scenario.
  const { data: approvedSub, error: approvedSubErr } = await admin
    .from('submissions')
    .insert({
      intern_id: internAlice.id,
      requirement_id: EVAL_PAPER_REQUIREMENT_ID,
      state: 'APPROVED',
      current_step: 2,
      current_holder_id: null,
      routing_snapshot: [
        { step: 1, role: 'approver', user_id: approverCarl.id },
        { step: 2, role: 'admin' },
      ],
    })
    .select('id')
    .single();
  if (approvedSubErr || !approvedSub) throw new Error(`Fixture setup failed creating approved submission: ${approvedSubErr?.message}`);
  approvedSubmissionId = approvedSub.id;
}, 30000);

afterAll(async () => {
  await admin.from('submissions').delete().in('id', [heldSubmissionId, approvedSubmissionId].filter(Boolean));
  await admin.storage.from('submissions').remove([heldSubmissionFilePath()]);
  await admin.storage.from('signatures').remove([carlSignaturePath()]);
  await Promise.all(
    [internAlice, internBob, approverCarl, approverDave, adminErin]
      .filter(Boolean)
      .map((u) => admin.auth.admin.deleteUser(u.id))
  );
});

describe('FR-26 #1: Intern reads another intern\'s submission', () => {
  it('is blocked by RLS -- zero rows, not an error, not the data', async () => {
    const { data, error } = await internBob.client
      .from('submissions')
      .select('*')
      .eq('id', heldSubmissionId);

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });
});

describe('FR-26 #2: Approver acts on a step not assigned to them', () => {
  it('is blocked when inserting an approval for a submission held by someone else', async () => {
    const { error } = await approverDave.client.from('approvals').insert({
      submission_id: heldSubmissionId,
      version_id: heldVersionId,
      approver_id: approverDave.id,
      step: 1,
      file_hash: 'b'.repeat(64),
    });

    expect(error).not.toBeNull();

    const { data: approvals } = await admin
      .from('approvals')
      .select('id')
      .eq('submission_id', heldSubmissionId)
      .eq('approver_id', approverDave.id);
    expect(approvals).toEqual([]);
  });
});

describe('FR-26 #3: Approver acts after being reassigned away from a step', () => {
  it('is blocked for the previous holder once current_holder_id has moved on', async () => {
    const { error: reassignErr } = await admin
      .from('submissions')
      .update({ current_holder_id: approverDave.id })
      .eq('id', heldSubmissionId);
    expect(reassignErr).toBeNull();

    const { error } = await approverCarl.client.from('approvals').insert({
      submission_id: heldSubmissionId,
      version_id: heldVersionId,
      approver_id: approverCarl.id,
      step: 1,
      file_hash: 'c'.repeat(64),
    });
    expect(error).not.toBeNull();

    const { data: approvals } = await admin
      .from('approvals')
      .select('id')
      .eq('submission_id', heldSubmissionId)
      .eq('approver_id', approverCarl.id);
    expect(approvals).toEqual([]);

    // restore fixture state for later tests
    await admin.from('submissions').update({ current_holder_id: approverCarl.id }).eq('id', heldSubmissionId);
  });
});

describe('FR-26 #4: Intern calls an admin-only endpoint', () => {
  it('cannot self-escalate role via a direct table update (regression for migration 20240101000012)', async () => {
    const { data, error } = await internAlice.client
      .from('users')
      .update({ role: 'system_admin' })
      .eq('id', internAlice.id)
      .select();

    expect(error).not.toBeNull();
    expect(error?.message).toContain('administrator');
    expect(data === null || data.length === 0).toBe(true);

    const { data: verify } = await admin.from('users').select('role').eq('id', internAlice.id).single();
    expect(verify?.role).toBe('intern');
  });

  it('cannot create a routing template (admin-only table management)', async () => {
    const { error } = await internAlice.client.from('routing_templates').insert({
      name: 'Rogue Template',
      steps: [{ step: 1, role: 'approver' }],
    });

    expect(error).not.toBeNull();
  });
});

describe('FR-26 #5: Attempt to edit an approved submission', () => {
  // Postgres RLS silently excludes rows the policy doesn't grant from an UPDATE's
  // match set -- it does not raise a permission error, it just updates zero rows.
  // `.select()` on the response is what surfaces that: an empty array means RLS
  // filtered the row out, which is the real signal that the edit was blocked.
  it('is blocked for the owning intern -- no client UPDATE policy exists on submissions', async () => {
    const { data, error } = await internAlice.client
      .from('submissions')
      .update({ state: 'DRAFT' })
      .eq('id', approvedSubmissionId)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: verify } = await admin.from('submissions').select('state').eq('id', approvedSubmissionId).single();
    expect(verify?.state).toBe('APPROVED');
  });

  it('is blocked for a non-admin approver too', async () => {
    const { data, error } = await approverCarl.client
      .from('submissions')
      .update({ state: 'DRAFT' })
      .eq('id', approvedSubmissionId)
      .select();

    expect(error).toBeNull();
    expect(data).toEqual([]);

    const { data: verify } = await admin.from('submissions').select('state').eq('id', approvedSubmissionId).single();
    expect(verify?.state).toBe('APPROVED');
  });
});

describe('FR-26 #6: Direct storage access bypassing a signed URL', () => {
  it('is blocked even for the submission\'s own owner (migration 20240101000011)', async () => {
    const { data, error } = await internAlice.client.storage.from('submissions').download(heldSubmissionFilePath());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('is blocked for a non-owner too', async () => {
    const { data, error } = await internBob.client.storage.from('submissions').download(heldSubmissionFilePath());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});

describe('FR-26 #7: Client-side fetch of a stored signature image', () => {
  it('is blocked even for the signature\'s own owner (migration 20240101000004)', async () => {
    const { data, error } = await approverCarl.client.storage.from('signatures').download(carlSignaturePath());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it('is blocked for a different approver', async () => {
    const { data, error } = await approverDave.client.storage.from('signatures').download(carlSignaturePath());
    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });
});
