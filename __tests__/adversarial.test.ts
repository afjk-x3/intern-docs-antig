import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserRole } from '../lib/data/users';
import { createServerClient } from '@supabase/ssr';

describe('Adversarial Tests (FR-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('Intern cannot update roles (Admin only)', async () => {
    // Mock the Supabase client behavior
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'intern-123' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'intern' }, // Current user is an intern
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    // Attempt to update role
    await expect(updateUserRole('target-user-id', 'admin')).rejects.toThrow('Unauthorized');
  });

  it('Approver cannot update roles (Admin only)', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'approver-456' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'approver' },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(updateUserRole('target-user-id', 'admin')).rejects.toThrow('Unauthorized');
  });

  it('Unauthenticated user cannot update roles', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
          error: { message: 'Not authenticated' },
        }),
      },
      from: vi.fn(),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(updateUserRole('target-user-id', 'admin')).rejects.toThrow('Not authenticated');
  });

  it('Password validation rejects strings under 12 characters (server-side)', async () => {
    // Import the Zod schema validation indirectly via the function
    const { updatePassword } = await import('../lib/data/auth');

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'user-789' } },
          error: null,
        }),
        updateUser: vi.fn(),
      },
      from: vi.fn(),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(updatePassword('short')).rejects.toThrow();
    // Supabase updateUser should NOT have been called
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('Login error response never contains the attempted password', async () => {
    // Mock the admin client used for audit logging on failed login
    vi.doMock('../lib/supabase/admin', () => ({
      createAdminClient: vi.fn(() => ({
        from: vi.fn().mockReturnValue({
          insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        }),
      })),
    }));

    const { login } = await import('../lib/data/auth');

    const mockSupabase = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          error: { message: 'Invalid login credentials' },
        }),
      },
      from: vi.fn(),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    const formData = new FormData();
    formData.set('email', 'test@example.com');
    formData.set('password', 'my-secret-password-123');

    const result = await login(formData);

    expect(result.success).toBe(false);
    // The error message must NEVER contain the password
    expect(result.error).not.toContain('my-secret-password-123');
    // It should use a generic message
    expect(result.error).toBe('Invalid email or password');
  });

  // Phase 2 tests — added as todos for immediate post-Phase-1 implementation
  it.todo('Intern requests another intern\'s submission id directly via API -> 403/404');
  it.todo('Intern attempts to change submission state directly without going through state machine');
  it.todo('Approver attempts to approve a submission not assigned to them');
});

