import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  requestPasswordReset,
  updatePassword,
  logPasswordUpdateAudit,
} from '../lib/data/auth';

const mockAdminGenerateLink = vi.fn();
const mockAdminUpdateUser = vi.fn();
const mockAuditInsert = vi.fn().mockResolvedValue({ data: null, error: null });
const mockGetUser = vi.fn();
const mockSendEmailWithRetry = vi.fn().mockResolvedValue({ success: true });

vi.mock('next/headers', () => ({
  headers: vi.fn().mockResolvedValue({
    get: (header: string) => {
      if (header === 'x-forwarded-host') return 'localhost:3000';
      if (header === 'x-forwarded-proto') return 'http';
      if (header === 'x-forwarded-for') return '192.168.1.100';
      return null;
    },
  }),
}));

vi.mock('../lib/email/resend', () => ({
  sendEmailWithRetry: (...args: unknown[]) => mockSendEmailWithRetry(...args),
}));

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        generateLink: mockAdminGenerateLink,
      },
    },
    from: vi.fn((table: string) => {
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
      updateUser: mockAdminUpdateUser,
    },
  })),
}));

describe('Password Reset & Recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('requestPasswordReset', () => {
    it('should reject invalid email formats', async () => {
      const res = await requestPasswordReset('not-an-email');
      expect(res.success).toBe(false);
      expect(res.error).toBe('Please enter a valid email address.');
      expect(mockAdminGenerateLink).not.toHaveBeenCalled();
      expect(mockAuditInsert).not.toHaveBeenCalled();
    });

    it('should send reset email and log audit event when user exists', async () => {
      mockAdminGenerateLink.mockResolvedValue({
        data: {
          user: { id: 'user-uuid-123' },
          properties: { action_link: 'http://localhost:3000/reset-password#access_token=xyz' },
        },
        error: null,
      });

      const res = await requestPasswordReset('intern@up.edu.ph');

      expect(res.success).toBe(true);
      expect(res.message).toContain('password reset link has been sent');

      // Verify recovery link was requested
      expect(mockAdminGenerateLink).toHaveBeenCalledWith({
        type: 'recovery',
        email: 'intern@up.edu.ph',
        options: {
          redirectTo: 'http://localhost:3000/reset-password',
        },
      });

      // Verify email was dispatched via Resend
      expect(mockSendEmailWithRetry).toHaveBeenCalledWith(
        'intern@up.edu.ph',
        expect.stringContaining('Password Reset'),
        expect.stringContaining('http://localhost:3000/reset-password#access_token=xyz')
      );

      // Verify audit log entry
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-uuid-123',
          action: 'PASSWORD_RESET_REQUESTED',
          target_id: 'user-uuid-123',
          target_type: 'auth',
          source_ip: '192.168.1.100',
          payload: { email: 'intern@up.edu.ph' },
        })
      );
    });

    it('should preserve anti-enumeration when email does not exist in DB', async () => {
      mockAdminGenerateLink.mockResolvedValue({
        data: null,
        error: { message: 'User not found' },
      });

      const res = await requestPasswordReset('unknown@unknown.com');

      // Must return identical generic success message
      expect(res.success).toBe(true);
      expect(res.message).toBe(
        'If an account exists with this email address, a password reset link has been sent.'
      );

      // Email should NOT be sent
      expect(mockSendEmailWithRetry).not.toHaveBeenCalled();

      // Audit log must still record the attempt with null user id
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: null,
          action: 'PASSWORD_RESET_REQUESTED',
          target_id: null,
          target_type: 'auth',
          source_ip: '192.168.1.100',
          payload: { email: 'unknown@unknown.com' },
        })
      );
    });
  });

  describe('updatePassword', () => {
    it('should fail if user is not authenticated', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null }, error: new Error('Not auth') });

      await expect(updatePassword('NewPassword1234!')).rejects.toThrow('Not authenticated');
      expect(mockAdminUpdateUser).not.toHaveBeenCalled();
    });

    it('should reject passwords shorter than 12 characters', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-uuid-456' } },
        error: null,
      });

      await expect(updatePassword('short123')).rejects.toThrow(
        'Password must be at least 12 characters'
      );
      expect(mockAdminUpdateUser).not.toHaveBeenCalled();
    });

    it('should update password and write UPDATE_PASSWORD audit log', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-uuid-456' } },
        error: null,
      });
      mockAdminUpdateUser.mockResolvedValue({ error: null });

      const res = await updatePassword('CorrectLengthPassword2026!');
      expect(res.success).toBe(true);

      expect(mockAdminUpdateUser).toHaveBeenCalledWith({
        password: 'CorrectLengthPassword2026!',
      });

      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-uuid-456',
          action: 'UPDATE_PASSWORD',
          target_id: 'user-uuid-456',
          target_type: 'users',
          source_ip: '192.168.1.100',
        })
      );
    });
  });

  describe('logPasswordUpdateAudit', () => {
    it('should record UPDATE_PASSWORD audit entry for current session', async () => {
      mockGetUser.mockResolvedValue({
        data: { user: { id: 'user-uuid-789' } },
        error: null,
      });

      const res = await logPasswordUpdateAudit();
      expect(res.success).toBe(true);

      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'user-uuid-789',
          action: 'UPDATE_PASSWORD',
          target_id: 'user-uuid-789',
          target_type: 'users',
          source_ip: '192.168.1.100',
        })
      );
    });
  });
});
