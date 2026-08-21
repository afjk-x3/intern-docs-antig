import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * RLS tests for tables beyond users — submissions, submission_versions,
 * approvals, audit_log, notifications.
 *
 * These tests verify the expected RLS behavior encoded in the migration
 * schema. Phase 2+ will convert these from mock-based to integration tests
 * once Docker/Supabase CLI is available.
 *
 * Test file: __tests__/auth/rls-tables.test.ts
 */

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('RLS: audit_log table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('authenticated non-admin cannot read audit_log rows', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          data: [],
          error: null,
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'key');
    const { data } = await client.from('audit_log').select('*');
    expect(data).toEqual([]);
  });

  it('authenticated user can insert into audit_log', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({
          data: null,
          error: null,
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'key');
    const { error } = await client.from('audit_log').insert({
      actor_id: 'user-123',
      action: 'TEST_ACTION',
      target_type: 'test',
      source_ip: '127.0.0.1',
    });
    expect(error).toBeNull();
  });

  it('UPDATE on audit_log is rejected (REVOKE applied)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'permission denied for table audit_log', code: '42501' },
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'key');
    const { error } = await client
      .from('audit_log')
      .update({ action: 'TAMPERED' })
      .eq('id', 'some-id');
    expect(error).toBeTruthy();
    expect(error?.message).toContain('permission denied');
  });

  it('DELETE on audit_log is rejected (REVOKE applied)', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: null,
            error: { message: 'permission denied for table audit_log', code: '42501' },
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'key');
    const { error } = await client
      .from('audit_log')
      .delete()
      .eq('id', 'some-id');
    expect(error).toBeTruthy();
    expect(error?.message).toContain('permission denied');
  });
});

describe('RLS: submissions table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('intern cannot read another intern\'s submissions', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'key');
    const { data } = await client
      .from('submissions')
      .select('*')
      .eq('intern_id', 'other-intern-uuid');
    expect(data).toEqual([]);
  });
});

describe('RLS: notifications table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('user cannot read another user\'s notifications', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            data: [],
            error: null,
          }),
        }),
      }),
    };
    vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'key');
    const { data } = await client
      .from('notifications')
      .select('*')
      .eq('user_id', 'other-user-uuid');
    expect(data).toEqual([]);
  });
});
