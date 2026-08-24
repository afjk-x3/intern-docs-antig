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
    REASSIGN: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.APPROVER, UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
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
