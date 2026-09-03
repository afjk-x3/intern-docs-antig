import { describe, it, expect, vi, beforeEach } from 'vitest';
import { internRegisterEmailSchema, registerIntern } from '../lib/data/auth';
import { onboardingSchema, completeInternOnboarding } from '../lib/data/users';

const mockAdminInviteUser = vi.fn();
const mockAdminGenerateLink = vi.fn();
const mockUsersUpsert = vi.fn();
const mockUsersUpdate = vi.fn();
const mockAuditInsert = vi.fn();
const mockGetUser = vi.fn();

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: vi.fn(() => ({
    auth: {
      admin: {
        inviteUserByEmail: mockAdminInviteUser,
        generateLink: mockAdminGenerateLink,
        listUsers: vi.fn().mockResolvedValue({ data: { users: [] } }),
      },
    },
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
            }),
          }),
          upsert: mockUsersUpsert,
          update: vi.fn().mockReturnValue({
            eq: mockUsersUpdate,
          }),
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
    },
    from: vi.fn((table: string) => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ data: [], error: null }),
      }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    })),
  })),
}));

describe('Intern Staged Registration & Onboarding (17-intern-self-registration)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Step 1: Email-Only Self-Registration (internRegisterEmailSchema & registerIntern)', () => {
    it('validates a valid email address', () => {
      const result = internRegisterEmailSchema.safeParse({ email: 'intern@makerspace.ph' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.email).toBe('intern@makerspace.ph');
      }
    });

    it('rejects invalid or malformed email', () => {
      const result = internRegisterEmailSchema.safeParse({ email: 'not-an-email' });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('valid email');
      }
    });

    it('creates intern identity with role: "intern", sends activation link, and logs audit event', async () => {
      mockAdminInviteUser.mockResolvedValueOnce({
        data: { user: { id: 'new-intern-uuid', email: 'intern@makerspace.ph' } },
        error: null,
      });
      mockUsersUpsert.mockResolvedValueOnce({ error: null });
      mockAuditInsert.mockResolvedValueOnce({ error: null });

      const formData = new FormData();
      formData.append('email', 'intern@makerspace.ph');

      const result = await registerIntern(formData);
      expect(result.success).toBe(true);

      // Verify user profile inserted with strict role: 'intern'
      expect(mockUsersUpsert).toHaveBeenCalledWith({
        id: 'new-intern-uuid',
        email: 'intern@makerspace.ph',
        role: 'intern',
      });

      // Verify audit event INTERN_REGISTRATION_REQUESTED logged
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'new-intern-uuid',
          action: 'INTERN_REGISTRATION_REQUESTED',
          target_id: 'new-intern-uuid',
          target_type: 'users',
        })
      );
    });
  });

  describe('Step 2: Cohort Onboarding (onboardingSchema & completeInternOnboarding)', () => {
    it('validates complete onboarding payload with school, batch, and valid dates', () => {
      const input = {
        school: 'University of the Philippines',
        batch: 'Batch 2026-A',
        start: '2026-06-01',
        end: '2026-09-01',
      };

      const result = onboardingSchema.safeParse(input);
      expect(result.success).toBe(true);
    });

    it('rejects missing or empty school', () => {
      const input = {
        school: '',
        batch: 'Batch 2026',
        start: '2026-06-01',
        end: '2026-09-01',
      };

      const result = onboardingSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('school or university');
      }
    });

    it('rejects missing or empty batch', () => {
      const input = {
        school: 'Ateneo de Manila',
        batch: '   ',
        start: '2026-06-01',
        end: '2026-09-01',
      };

      const result = onboardingSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('batch or academic year');
      }
    });

    it('rejects invalid date ranges (end before start)', () => {
      const input = {
        school: 'UST',
        batch: '2026',
        start: '2026-09-01',
        end: '2026-06-01',
      };

      const result = onboardingSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues[0]?.message).toContain('End date must be after start date');
      }
    });

    it('saves school, batch, and dates to user profile and logs INTERN_ONBOARDING_COMPLETED', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'intern-123', email: 'intern@makerspace.ph' } },
        error: null,
      });
      mockUsersUpdate.mockResolvedValueOnce({ error: null });
      mockAuditInsert.mockResolvedValueOnce({ error: null });

      const result = await completeInternOnboarding(
        'De La Salle University',
        'Batch 2026-B',
        '2026-06-01',
        '2026-09-01'
      );

      expect(result.success).toBe(true);
      expect(mockUsersUpdate).toHaveBeenCalledWith('id', 'intern-123');
      expect(mockAuditInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          actor_id: 'intern-123',
          action: 'INTERN_ONBOARDING_COMPLETED',
          target_id: 'intern-123',
          target_type: 'users',
          payload: { school: 'De La Salle University', batch: 'Batch 2026-B' },
        })
      );
    });
  });
});
