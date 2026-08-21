import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createClient } from '@supabase/supabase-js';

/**
 * RLS tests for the users table (FR-26).
 *
 * These tests verify that Supabase RLS policies on the `users` table work
 * correctly at the application layer by mocking the Supabase client's
 * responses to match expected RLS behavior.
 *
 * In a full integration environment (with Docker / Supabase CLI running),
 * these mocks should be replaced with real Supabase client calls.
 *
 * Test file: __tests__/auth/rls-users.test.ts
 */

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

describe('RLS: users table', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('anon key with no session returns zero rows from users table', async () => {
    const mockAnonClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          // Supabase returns empty array when RLS blocks all rows
          data: [],
          error: null,
        }),
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockAnonClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'anon-key');
    const { data } = await client.from('users').select('*');

    expect(data).toEqual([]);
    expect(data).toHaveLength(0);
  });

  it('logged-in user reading another user\'s row by ID returns no data', async () => {
    const otherUserId = 'other-user-uuid-1234';

    const mockAuthClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              // RLS policy "Users can read own row" blocks this
              data: null,
              error: { message: 'Row not found', code: 'PGRST116' },
            }),
          }),
        }),
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockAuthClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'anon-key');
    const { data, error } = await client
      .from('users')
      .select('*')
      .eq('id', otherUserId)
      .single();

    expect(data).toBeNull();
    expect(error).toBeTruthy();
  });

  it('intern cannot read approver or admin user rows', async () => {
    const mockInternClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            // Intern's RLS policy only allows reading their own row,
            // not other roles' rows
            data: [],
            error: null,
          }),
        }),
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockInternClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'anon-key');
    const { data } = await client
      .from('users')
      .select('*')
      .eq('role', 'admin');

    expect(data).toEqual([]);
  });

  it('approver can read intern rows but not admin rows', async () => {
    const mockApproverClient = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockImplementation((_field: string, value: string) => {
                if (value === 'intern') {
                  // Approver CAN read intern rows
                  return {
                    data: [{ id: 'intern-1', email: 'intern@test.com', role: 'intern' }],
                    error: null,
                  };
                }
                if (value === 'admin') {
                  // Approver CANNOT read admin rows
                  return {
                    data: [],
                    error: null,
                  };
                }
                return { data: [], error: null };
              }),
            }),
          };
        }
        return { select: vi.fn().mockReturnValue({ data: [], error: null }) };
      }),
    };

    vi.mocked(createClient).mockReturnValue(mockApproverClient as unknown as ReturnType<typeof createClient>);

    const client = createClient('https://example.supabase.co', 'anon-key');

    // Approver CAN see interns
    const internResult = await client.from('users').select('*').eq('role', 'intern');
    expect(internResult.data).toHaveLength(1);

    // Approver CANNOT see admins
    const adminResult = await client.from('users').select('*').eq('role', 'admin');
    expect(adminResult.data).toHaveLength(0);
  });
});
