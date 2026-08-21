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
    ASSIGN_STEP: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.SYSTEM_ADMIN] }, // Triggered by system
    EXPIRE: { to: SubmissionState.EXPIRED, allowedRoles: [UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.IN_REVIEW]: {
    APPROVE_INTERMEDIATE: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.APPROVER] },
    APPROVE_FINAL: { to: SubmissionState.APPROVED, allowedRoles: [UserRole.APPROVER] },
    RETURN: { to: SubmissionState.RETURNED, allowedRoles: [UserRole.APPROVER] },
    REASSIGN: { to: SubmissionState.IN_REVIEW, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    EXPIRE: { to: SubmissionState.EXPIRED, allowedRoles: [UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.RETURNED]: {
    RESUBMIT: { to: SubmissionState.SUBMITTED, allowedRoles: [UserRole.INTERN] },
    CANCEL: { to: SubmissionState.CANCELLED, allowedRoles: [UserRole.ADMIN, UserRole.SYSTEM_ADMIN] },
    EXPIRE: { to: SubmissionState.EXPIRED, allowedRoles: [UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.APPROVED]: {
    PURGE: { to: SubmissionState.PURGED, allowedRoles: [UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.CANCELLED]: {
    PURGE: { to: SubmissionState.PURGED, allowedRoles: [UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.EXPIRED]: {
    PURGE: { to: SubmissionState.PURGED, allowedRoles: [UserRole.SYSTEM_ADMIN] },
  },
  [SubmissionState.PURGED]: {},
};

export function canTransition(currentState: SubmissionState, action: Action, role: UserRole): boolean {
  const rule = StateMachine[currentState][action];
  if (!rule) return false;
  
  // system_admin is meant for system tasks like assigning steps or purging.
  // In a real application, you might use a specific service role token to represent the system.
  return rule.allowedRoles.includes(role);
}

export function getNextState(currentState: SubmissionState, action: Action): SubmissionState | null {
  const rule = StateMachine[currentState][action];
  if (!rule) return null;
  return rule.to;
}
