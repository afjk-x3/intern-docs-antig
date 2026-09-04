import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  internSelfRegistrationSchema,
  registerInternWithPassword,
  login,
} from '../lib/data/auth';
import { approveInternRegistration } from '../lib/data/users';

const mockAdminCreateUser = vi.fn();
const mockAdminGetUserById = vi.fn();
const mockAdminUpdateUserById = vi.fn();
const mockUsersUpsert = vi.fn();
const mockAuditInsert = vi.fn();
const mockGetUser = vi.fn();
const mockSignOut = vi.fn();
const mockSignInWithPassword = vi.fn();
const mockSendEmailWithRetry = vi.fn();

vi.mock('../lib/email/resend', () => ({
  sendEmailWithRetry: (...args: unknown[]) => mockSendEmailWithRetry(...args),
}));

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        createUser: mockAdminCreateUser,
        getUserById: mockAdminGetUserById,
        updateUserById: mockAdminUpdateUserById,
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
              single: vi.fn().mockResolvedValue({
                data: {
                  email: 'intern@up.edu.ph',
                  full_name: 'Maria Santos',
                  school: 'University of the Philippines',
                  batch: '5',
                },
                error: null,
              }),
            }),
          }),
          upsert: mockUsersUpsert,
        };
      }
      if (table === 'audit_log') {
        return {
          insert: mockAuditInsert,
        };
      }
      return {
        insert: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  })),
}));

vi.mock('../lib/supabase/server', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: mockGetUser,
      signOut: mockSignOut,
      signInWithPassword: mockSignInWithPassword,
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({
            data: { role: 'admin' },
            error: null,
          }),
        }),
      }),
    })),
  })),
}));

describe('Intern Self-Registration, Numeric Batch & Admin Approval', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Validation Schema (internSelfRegistrationSchema)', () => {
    const validPayload = {
      fullName: 'Juan dela Cruz',
      email: 'juan@up.edu.ph',
      password: 'SecurePassword123!',
      confirmPassword: 'SecurePassword123!',
      school: 'University of the Philippines',
      batch: '5',
      start: '2026-09-01',
      end: '2026-12-01',
    };

    it('accepts valid input with numeric batch number', () => {
      const result = internSelfRegistrationSchema.safeParse(validPayload);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch).toBe('5');
        expect(result.data.fullName).toBe('Juan dela Cruz');
      }
    });

    it('accepts multi-digit numeric batch number (e.g. 2026)', () => {
      const result = internSelfRegistrationSchema.safeParse({
        ...validPayload,
        batch: '2026',
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.batch).toBe('2026');
      }
    });

    it('rejects non-numeric batch numbers (letters or symbols)', () => {
      const invalidBatches = ['Batch 5', 'Cohort-A', 'Summer2026', '5A', 'B5'];
      for (const batch of invalidBatches) {
        const result = internSelfRegistrationSchema.safeParse({
          ...validPayload,
          batch,
        });
        expect(result.success).toBe(false);
        if (!result.success) {
          expect(result.error.issues[0]?.message).toContain('Batch number must contain numbers only');
        }
      }
    });

    it('rejects passwords shorter than 12 characters', () => {
      const result = internSelfRegistrationSchema.safeParse({
        ...validPayload,
        password: 'Short123!',
        confirmPassword: 'Short123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('at least 12 characters');
      }
    });

    it('rejects mismatched password and confirmPassword', () => {
      const result = internSelfRegistrationSchema.safeParse({
        ...validPayload,
        password: 'SecurePassword123!',
        confirmPassword: 'DifferentPassword123!',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('Passwords do not match');
      }
    });

    it('rejects invalid OJT date ranges (end before start)', () => {
      const result = internSelfRegistrationSchema.safeParse({
        ...validPayload,
        start: '2026-12-01',
        end: '2026-09-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('End date must be after start date');
      }
    });

    it('rejects OJT duration exceeding 12 months', () => {
      const result = internSelfRegistrationSchema.safeParse({
        ...validPayload,
        start: '2026-01-01',
        end: '2027-02-01',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('cannot exceed 12 months');
      }
    });
  });

  describe('2. Self-Registration Submission (registerInternWithPassword)', () => {
    it('creates user identity with approved: false and logs INTERN_REGISTRATION_REQUESTED', async () => {
      mockAdminCreateUser.mockResolvedValueOnce({
        data: { user: { id: 'pending-intern-id', email: 'juan@up.edu.ph' } },
        error: null,
      });
      mockUsersUpsert.mockResolvedValueOnce({ error: null });
      mockAuditInsert.mockResolvedValueOnce({ error: null });

      const formData = new FormData();
      formData.append('fullName', 'Juan dela Cruz');
      formData.append('email', 'juan@up.edu.ph');
      formData.append('password', 'SecurePassword123!');
      formData.append('confirmPassword', 'SecurePassword123!');
      formData.append('school', 'University of the Philippines');
      formData.append('batch', '5');
      formData.append('start', '2026-09-01');
      formData.append('end', '2026-12-01');

      const result = await registerInternWithPassword(formData);
      expect(result.success).toBe(true);
      expect(result.name).toBe('Juan dela Cruz');

      // Verify user created with approved: false in metadata
      expect(mockAdminCreateUser).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'juan@up.edu.ph',
          password: 'SecurePassword123!',
          user_metadata: expect.objectContaining({
            full_name: 'Juan dela Cruz',
            school: 'University of the Philippines',
            batch: '5',
            approved: false,
          }),
        })
      );

      // Verify profile upsert with role: 'intern'
      expect(mockUsersUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'pending-intern-id',
          email: 'juan@up.edu.ph',
          role: 'intern',
          full_name: 'Juan dela Cruz',
          school: 'University of the Philippines',
          batch: '5',
        })
      );

      // Verify append-only audit event
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'pending-intern-id',
          action: 'INTERN_REGISTRATION_REQUESTED',
          target_type: 'users',
        })
      );
    });
  });

  describe('3. Login Gate for Pending Accounts', () => {
    it('blocks login and signs out if user has approved: false in metadata', async () => {
      mockSignInWithPassword.mockResolvedValueOnce({
        data: {
          user: {
            id: 'unapproved-user',
            email: 'unapproved@up.edu.ph',
            user_metadata: {
              approved: false,
            },
          },
        },
        error: null,
      });
      mockSignOut.mockResolvedValueOnce({ error: null });

      const formData = new FormData();
      formData.append('email', 'unapproved@up.edu.ph');
      formData.append('password', 'ValidPassword123!');

      const result = await login(formData);

      expect(result.success).toBe(false);
      expect(result.isPendingApproval).toBe(true);
      expect(result.error).toContain('pending administrator approval');
      expect(mockSignOut).toHaveBeenCalledTimes(1);
    });
  });

  describe('4. Admin Approval & Resend Dispatch (approveInternRegistration)', () => {
    it('updates user_metadata.approved to true, dispatches Resend email, and logs audit event', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'admin-id' } },
        error: null,
      });

      mockAdminGetUserById.mockResolvedValueOnce({
        data: {
          user: {
            id: 'target-intern-id',
            email: 'intern@up.edu.ph',
            user_metadata: {
              full_name: 'Maria Santos',
              school: 'University of the Philippines',
              batch: '5',
              approved: false,
            },
          },
        },
        error: null,
      });

      mockAdminUpdateUserById.mockResolvedValueOnce({ error: null });
      mockSendEmailWithRetry.mockResolvedValueOnce({ success: true });
      mockAuditInsert.mockResolvedValueOnce({ error: null });

      const result = await approveInternRegistration('target-intern-id');

      expect(result.success).toBe(true);

      // Verify metadata updated to approved: true
      expect(mockAdminUpdateUserById).toHaveBeenCalledWith(
        'target-intern-id',
        expect.objectContaining({
          user_metadata: expect.objectContaining({
            approved: true,
          }),
        })
      );

      // Verify Resend email dispatched
      expect(mockSendEmailWithRetry).toHaveBeenCalledWith(
        'intern@up.edu.ph',
        expect.stringContaining('Approved'),
        expect.stringContaining('University of the Philippines')
      );

      // Verify INTERN_REGISTRATION_APPROVED logged
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'admin-id',
          action: 'INTERN_REGISTRATION_APPROVED',
          target_id: 'target-intern-id',
        })
      );
    });
  });
});
