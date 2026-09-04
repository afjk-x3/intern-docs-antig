'use server';

import { requestPasswordReset, logPasswordUpdateAudit } from '../../../lib/data/auth';

export async function requestPasswordResetAction(email: string) {
  try {
    return await requestPasswordReset(email);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Failed to request password reset.';
    return { success: false, error: msg };
  }
}

export async function recordPasswordUpdateAuditAction() {
  try {
    return await logPasswordUpdateAudit();
  } catch (err: unknown) {
    console.warn('[Audit] recordPasswordUpdateAuditAction non-fatal error:', err);
    return { success: false };
  }
}
