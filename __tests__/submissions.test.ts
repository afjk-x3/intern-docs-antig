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
});
