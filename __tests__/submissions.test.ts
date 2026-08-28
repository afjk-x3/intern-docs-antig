import { describe, it, expect } from 'vitest';
import {
  SubmissionState,
  UserRole,
  validateTransition,
  IllegalTransitionError,
  canTransition,
} from '../lib/state-machine';

describe('Submission State Machine Transitions (Appendix A)', () => {
  it('allows Intern to submit from DRAFT to SUBMITTED', () => {
    const next = validateTransition(SubmissionState.DRAFT, 'SUBMIT', UserRole.INTERN);
    expect(next).toBe(SubmissionState.SUBMITTED);
  });

  it('allows Approver to approve final from IN_REVIEW to APPROVED', () => {
    const next = validateTransition(SubmissionState.IN_REVIEW, 'APPROVE_FINAL', UserRole.APPROVER);
    expect(next).toBe(SubmissionState.APPROVED);
  });

  it('allows Approver to return from IN_REVIEW to RETURNED', () => {
    const next = validateTransition(SubmissionState.IN_REVIEW, 'RETURN', UserRole.APPROVER);
    expect(next).toBe(SubmissionState.RETURNED);
  });

  it('allows Intern to resubmit from RETURNED to SUBMITTED', () => {
    const next = validateTransition(SubmissionState.RETURNED, 'RESUBMIT', UserRole.INTERN);
    expect(next).toBe(SubmissionState.SUBMITTED);
  });

  it('rejects Intern attempting to approve directly (409 IllegalTransitionError)', () => {
    expect(() =>
      validateTransition(SubmissionState.IN_REVIEW, 'APPROVE_FINAL', UserRole.INTERN)
    ).toThrow(IllegalTransitionError);
  });

  it('rejects approving a DRAFT directly without submitting (409)', () => {
    expect(() =>
      validateTransition(SubmissionState.DRAFT, 'APPROVE_FINAL', UserRole.APPROVER)
    ).toThrow(IllegalTransitionError);
  });

  it('APPROVED state is terminal for non-system roles (cannot return or edit)', () => {
    expect(canTransition(SubmissionState.APPROVED, 'RETURN', UserRole.APPROVER)).toBe(false);
    expect(canTransition(SubmissionState.APPROVED, 'SUBMIT', UserRole.INTERN)).toBe(false);
  });

  // Audit gap #21 (docs/09-project-audit.md, 2026-08-28): CANCEL had a rule but no
  // caller; REOPEN didn't exist as an action at all. Both wired up this pass.
  it('allows Administrator to cancel from DRAFT', () => {
    const next = validateTransition(SubmissionState.DRAFT, 'CANCEL', UserRole.ADMIN);
    expect(next).toBe(SubmissionState.CANCELLED);
  });

  it('allows Administrator to cancel from RETURNED', () => {
    const next = validateTransition(SubmissionState.RETURNED, 'CANCEL', UserRole.SYSTEM_ADMIN);
    expect(next).toBe(SubmissionState.CANCELLED);
  });

  it('rejects a non-administrator cancelling (Intern, Approver)', () => {
    expect(() => validateTransition(SubmissionState.DRAFT, 'CANCEL', UserRole.INTERN)).toThrow(IllegalTransitionError);
    expect(() => validateTransition(SubmissionState.RETURNED, 'CANCEL', UserRole.APPROVER)).toThrow(IllegalTransitionError);
  });

  it('rejects cancelling a submission already IN_REVIEW or APPROVED', () => {
    expect(() => validateTransition(SubmissionState.IN_REVIEW, 'CANCEL', UserRole.ADMIN)).toThrow(IllegalTransitionError);
    expect(() => validateTransition(SubmissionState.APPROVED, 'CANCEL', UserRole.ADMIN)).toThrow(IllegalTransitionError);
  });

  it('allows Administrator to reopen an EXPIRED submission back to IN_REVIEW', () => {
    const next = validateTransition(SubmissionState.EXPIRED, 'REOPEN', UserRole.ADMIN);
    expect(next).toBe(SubmissionState.IN_REVIEW);
  });

  it('rejects a non-administrator reopening an EXPIRED submission', () => {
    expect(() => validateTransition(SubmissionState.EXPIRED, 'REOPEN', UserRole.APPROVER)).toThrow(IllegalTransitionError);
  });

  it('rejects reopening anything other than EXPIRED (e.g. CANCELLED, PURGED)', () => {
    expect(() => validateTransition(SubmissionState.CANCELLED, 'REOPEN', UserRole.ADMIN)).toThrow(IllegalTransitionError);
    expect(() => validateTransition(SubmissionState.PURGED, 'REOPEN', UserRole.ADMIN)).toThrow(IllegalTransitionError);
  });
});
