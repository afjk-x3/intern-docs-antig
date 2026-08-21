import { describe, it, expect, vi, beforeEach } from 'vitest';
import { updateUserRole } from '../lib/data/users';
import { getSubmissionDetails, approveSubmissionSigned, reassignApprover, getSubmissionSignedDownloadUrl } from '../lib/data/submissions';
import { validateTransition, IllegalTransitionError, SubmissionState, UserRole } from '../lib/state-machine';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '../lib/supabase/admin';

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Adversarial Tests (FR-26)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
        update: vi.fn().mockResolvedValue({ data: null, error: null }),
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: null, error: null }),
          }),
        }),
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          upload: vi.fn().mockResolvedValue({ error: null }),
          download: vi.fn().mockResolvedValue({ data: null, error: null }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.co/signed' }, error: null }),
        }),
      },
    } as unknown as ReturnType<typeof createAdminClient>);
  });

  it('Intern cannot update roles (Admin only)', async () => {
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
              data: { role: 'intern' },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

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
    expect(mockSupabase.auth.updateUser).not.toHaveBeenCalled();
  });

  it('Login error response never contains the attempted password', async () => {
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
    expect(result.error).not.toContain('my-secret-password-123');
    expect(result.error).toBe('Invalid email or password');
  });

  // Phase 2 Adversarial Tests (FR-26)
  it('Intern requesting another intern\'s submission id directly is rejected (403/Forbidden)', async () => {
    const currentInternId = 'intern-alice';
    const targetSubmissionId = 'sub-of-bob';

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: currentInternId } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'intern' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: targetSubmissionId,
                    intern_id: 'intern-bob', // Belongs to Bob, NOT Alice!
                    state: 'SUBMITTED',
                    submission_versions: [],
                    approvals: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(getSubmissionDetails(targetSubmissionId)).rejects.toThrow(
      'Forbidden: You cannot access another intern\'s submission'
    );
  });

  it('Illegal state transition attempt directly without valid workflow path throws 409', () => {
    // Attempt to approve a DRAFT directly
    expect(() =>
      validateTransition(SubmissionState.DRAFT, 'APPROVE_FINAL', UserRole.APPROVER)
    ).toThrow(IllegalTransitionError);

    // Attempt by intern to force APPROVED state
    expect(() =>
      validateTransition(SubmissionState.IN_REVIEW, 'APPROVE_FINAL', UserRole.INTERN)
    ).toThrow(IllegalTransitionError);
  });

  it('Approver attempting to access a submission step not assigned to them is rejected (403)', async () => {
    const approverCarlId = 'approver-carl';
    const targetSubmissionId = 'sub-assigned-to-lead-only';

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: approverCarlId } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'approver' },
                  error: null,
                }),
              }),
            }),
          };
        }
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: targetSubmissionId,
                    intern_id: 'intern-alice',
                    current_step: 2,
                    current_holder_id: 'approver-different-user', // Not Carl!
                    requirements: {
                      routing_templates: {
                        steps: [
                          { step: 1, role: 'approver' },
                          { step: 2, role: 'admin', user_id: 'admin-lead-user' },
                        ],
                      },
                    },
                    submission_versions: [],
                    approvals: [],
                  },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(getSubmissionDetails(targetSubmissionId)).rejects.toThrow(
      'Forbidden: This submission is not assigned to your review'
    );
  });

  // Phase 3 Adversarial Tests (FR-9, FR-11, FR-15, FR-25)
  it('Approval is blocked if approver has not enrolled a signature (FR-9)', async () => {
    const approverId = 'approver-without-sig';

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: approverId } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { role: 'approver', email: 'approver@test.com', signature_path: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    const mockAdmin = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: { signature_path: null },
                  error: null,
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as unknown as ReturnType<typeof createAdminClient>);

    await expect(approveSubmissionSigned('sub-123')).rejects.toThrow(
      'Signature Required: You must enroll your signature image before approving documents.'
    );
  });

  it('Approver reassignment rejects reasons under 10 characters (FR-15)', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'admin-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: 'admin' },
              error: null,
            }),
          }),
        }),
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(
      reassignApprover('sub-1', 'new-approver', 'too short')
    ).rejects.toThrow('Reassignment reason must be at least 10 characters');
  });

  it('Download integrity verification detects tampered document bytes and raises alert (FR-25)', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: 'intern-1' } },
          error: null,
        }),
      },
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'users') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({ data: { role: 'intern' } }),
              }),
            }),
          };
        }
        if (table === 'submissions') {
          return {
            select: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({
                single: vi.fn().mockResolvedValue({
                  data: {
                    id: 'sub-1',
                    intern_id: 'intern-1',
                    state: 'APPROVED',
                    submission_versions: [{ id: 'v1', file_url: 'sub-1/v1.pdf', file_hash: 'expected-original-hash' }],
                    approvals: [{ id: 'a1', version_id: 'v1', file_hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855', signed_pdf_url: 'sub-1/v1_signed.pdf' }],
                  },
                }),
              }),
            }),
          };
        }
        return { select: vi.fn() };
      }),
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({
            data: {
              arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('corrupted bytes').buffer),
            },
            error: null,
          }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.com/signed' } }),
        }),
      },
    };

    const mockAdmin = {
      storage: {
        from: vi.fn().mockReturnValue({
          download: vi.fn().mockResolvedValue({
            // Corrupted / modified file content that produces a different hash
            data: {
              arrayBuffer: vi.fn().mockResolvedValue(new TextEncoder().encode('corrupted bytes').buffer),
            },
            error: null,
          }),
          createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'https://test.com/signed' } }),
        }),
      },
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      }),
    };

    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);
    vi.mocked(createAdminClient).mockReturnValue(mockAdmin as unknown as ReturnType<typeof createAdminClient>);

    await expect(getSubmissionSignedDownloadUrl('sub-1')).rejects.toThrow(
      'Integrity Warning: Document SHA-256 hash does not match recorded approval checksum.'
    );
  });
});
