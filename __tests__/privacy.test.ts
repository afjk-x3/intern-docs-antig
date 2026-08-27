import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createServerClient } from '@supabase/ssr';
import { createAdminClient } from '../lib/supabase/admin';
import { getPrivacyAcknowledgmentStatus, acknowledgePrivacyNotice } from '../lib/data/privacy';

vi.mock('../lib/supabase/admin', () => ({
  createAdminClient: vi.fn(),
}));

describe('Privacy notice acknowledgment (FR-25)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getPrivacyAcknowledgmentStatus reports false when privacy_acknowledged_at is null', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'intern-1' } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { privacy_acknowledged_at: null }, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    const result = await getPrivacyAcknowledgmentStatus();
    expect(result.acknowledged).toBe(false);
  });

  it('getPrivacyAcknowledgmentStatus reports true once a timestamp is recorded', async () => {
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'intern-1' } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({ data: { privacy_acknowledged_at: '2026-08-27T00:00:00Z' }, error: null }),
          }),
        }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    const result = await getPrivacyAcknowledgmentStatus();
    expect(result.acknowledged).toBe(true);
  });

  it('getPrivacyAcknowledgmentStatus rejects when unauthenticated', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(getPrivacyAcknowledgmentStatus()).rejects.toThrow('Not authenticated');
  });

  it('acknowledgePrivacyNotice writes a timestamp and an audit log entry', async () => {
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'intern-1' } }, error: null }),
      },
      from: vi.fn().mockReturnValue({
        update: vi.fn().mockReturnValue({ eq: updateEq }),
      }),
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    const auditInsert = vi.fn().mockResolvedValue({ data: null, error: null });
    vi.mocked(createAdminClient).mockReturnValue({
      from: vi.fn().mockReturnValue({ insert: auditInsert }),
    } as unknown as ReturnType<typeof createAdminClient>);

    const result = await acknowledgePrivacyNotice();

    expect(result.success).toBe(true);
    expect(mockSupabase.from).toHaveBeenCalledWith('users');
    expect(auditInsert).toHaveBeenCalledWith(
      expect.objectContaining({ actor_id: 'intern-1', action: 'PRIVACY_NOTICE_ACKNOWLEDGED', target_id: 'intern-1' })
    );
  });

  it('acknowledgePrivacyNotice rejects when unauthenticated', async () => {
    const mockSupabase = {
      auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: { message: 'Not authenticated' } }) },
      from: vi.fn(),
    };
    vi.mocked(createServerClient).mockReturnValue(mockSupabase as unknown as ReturnType<typeof createServerClient>);

    await expect(acknowledgePrivacyNotice()).rejects.toThrow('Not authenticated');
  });
});
