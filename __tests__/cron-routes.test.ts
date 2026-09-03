import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('@lib/jobs/retention-sweep', () => ({
  runRetentionSweep: vi.fn(async () => undefined),
}));
vi.mock('@lib/jobs/daily-digest', () => ({
  runDailyDigest: vi.fn(async () => undefined),
}));

import { runRetentionSweep } from '@lib/jobs/retention-sweep';
import { runDailyDigest } from '@lib/jobs/daily-digest';
import { POST as retentionSweepRoute } from '../src/app/api/cron/retention-sweep/route';
import { POST as dailyDigestRoute } from '../src/app/api/cron/daily-digest/route';

const ORIGINAL_SECRET = process.env.CRON_SECRET;

describe('Scheduled job routes (audit gap #18 — pg_cron -> pg_net -> these routes)', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'test-cron-secret';
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.CRON_SECRET = ORIGINAL_SECRET;
  });

  it('rejects a request with no Authorization header', async () => {
    const res = await retentionSweepRoute(new Request('http://localhost/api/cron/retention-sweep', { method: 'POST' }));
    expect(res.status).toBe(401);
    expect(runRetentionSweep).not.toHaveBeenCalled();
  });

  it('rejects a request with the wrong secret', async () => {
    const res = await retentionSweepRoute(new Request('http://localhost/api/cron/retention-sweep', {
      method: 'POST',
      headers: { Authorization: 'Bearer wrong-secret' },
    }));
    expect(res.status).toBe(401);
    expect(runRetentionSweep).not.toHaveBeenCalled();
  });

  it('rejects every request when CRON_SECRET is unset, even a matching-looking header', async () => {
    delete process.env.CRON_SECRET;
    const res = await retentionSweepRoute(new Request('http://localhost/api/cron/retention-sweep', {
      method: 'POST',
      headers: { Authorization: 'Bearer undefined' },
    }));
    expect(res.status).toBe(401);
  });

  it('runs the retention sweep and returns success with the correct secret', async () => {
    const res = await retentionSweepRoute(new Request('http://localhost/api/cron/retention-sweep', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    }));
    expect(res.status).toBe(200);
    expect(runRetentionSweep).toHaveBeenCalledTimes(1);
  });

  it('runs the daily digest and returns success with the correct secret', async () => {
    const res = await dailyDigestRoute(new Request('http://localhost/api/cron/daily-digest', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    }));
    expect(res.status).toBe(200);
    expect(runDailyDigest).toHaveBeenCalledTimes(1);
  });

  it('rejects the daily digest route with a bad secret without running the job', async () => {
    const res = await dailyDigestRoute(new Request('http://localhost/api/cron/daily-digest', {
      method: 'POST',
      headers: { Authorization: 'Bearer nope' },
    }));
    expect(res.status).toBe(401);
    expect(runDailyDigest).not.toHaveBeenCalled();
  });

  it('returns 500 (not a thrown exception) when the job itself fails', async () => {
    vi.mocked(runRetentionSweep).mockRejectedValueOnce(new Error('boom'));
    const res = await retentionSweepRoute(new Request('http://localhost/api/cron/retention-sweep', {
      method: 'POST',
      headers: { Authorization: 'Bearer test-cron-secret' },
    }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe('boom');
  });
});
