import 'server-only';

export enum SubmissionState {
  DRAFT = 'DRAFT',
  SUBMITTED = 'SUBMITTED',
  IN_REVIEW = 'IN_REVIEW',
  RETURNED = 'RETURNED',
  APPROVED = 'APPROVED',
  CANCELLED = 'CANCELLED',
  EXPIRED = 'EXPIRED',
  PURGED = 'PURGED',
}

export enum UserRole {
  INTERN = 'intern',
  APPROVER = 'approver',
  ADMIN = 'admin',
  SYSTEM_ADMIN = 'system_admin',
}

export type Action =
  | 'CREATE'
  | 'SUBMIT'
  | 'ASSIGN_STEP'
  | 'APPROVE_INTERMEDIATE'
  | 'APPROVE_FINAL'
  | 'RETURN'
  | 'RESUBMIT'
  | 'REASSIGN'
  | 'CANCEL'
  | 'EXPIRE'
  | 'REOPEN'
  | 'PURGE';

export type TransitionRule = {
  to: SubmissionState;
  allowedRoles: UserRole[];
};

export const StateMachine: Record<SubmissionState, Partial<Record<Action, TransitionRule>>> = {
  [SubmissionState.DRAFT]: {
    SUBMIT: { to: SubmissionState.SUBMITTED, allowedRoles: [UserRole.INTERN] },
    CANCEL: { to: SubmissionState.CANCELLED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.SUBMITTED]: {
    ASSIGN_STEP: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    EXPIRE: { to: SubmissionState.EXPIRED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.IN_REVIEW]: {
    APPROVE_INTERMEDIATE: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.APPROVER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    APPROVE_FINAL: { to: SubmissionState.APPROVED, allowedRoles: [UserRole.APPROVER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    RETURN: { to: SubmissionState.RETURNED, allowedRoles: [UserRole.APPROVER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    // FR-15 / Appendix A: only an Administrator may trigger a reassignment.
    REASSIGN: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    EXPIRE: { to: SubmissionState.EXPIRED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.RETURNED]: {
    RESUBMIT: { to: SubmissionState.SUBMITTED, allowedRoles: [UserRole.INTERN] },
    CANCEL: { to: SubmissionState.CANCELLED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    EXPIRE: { to: SubmissionState.EXPIRED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.APPROVED]: {
    PURGE: { to: SubmissionState.PURGED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.CANCELLED]: {
    PURGE: { to: SubmissionState.PURGED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.EXPIRED]: {
    PURGE: { to: SubmissionState.PURGED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    // Appendix A: "Admin may reopen." Goes back to IN_REVIEW rather than a state-specific
    // target, because EXPIRE (see lib/jobs/retention-sweep.ts) only ever changes `state` --
    // current_step/current_holder_id are left exactly as they were, so reopening into
    // IN_REVIEW puts it back in front of whoever already held it (or, if it expired before
    // ever being assigned, current_holder_id is still null, which the approver queue
    // already treats as visible to any approver -- same as a freshly submitted item).
    REOPEN: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.PURGED]: {},
};

export class IllegalTransitionError extends Error {
  statusCode: number;
  constructor(message: string) {
    super(message);
    this.name = 'IllegalTransitionError';
    this.statusCode = 409;
  }
}

export function canTransition(currentState: SubmissionState, action: Action, role: UserRole): boolean {
  const rule = StateMachine[currentState]?.[action];
  if (!rule) return false;
  return rule.allowedRoles.includes(role);
}

export function getNextState(currentState: SubmissionState, action: Action): SubmissionState | null {
  const rule = StateMachine[currentState]?.[action];
  if (!rule) return null;
  return rule.to;
}

export function validateTransition(currentState: SubmissionState, action: Action, role: UserRole): SubmissionState {
  if (!canTransition(currentState, action, role)) {
    throw new IllegalTransitionError(
      `Illegal transition: Cannot perform action '${action}' on submission in state '${currentState}' with role '${role}'.`
    );
  }
  const next = getNextState(currentState, action);
  if (!next) {
    throw new IllegalTransitionError(
      `No target state defined for action '${action}' from '${currentState}'.`
    );
  }
  return next;
}
