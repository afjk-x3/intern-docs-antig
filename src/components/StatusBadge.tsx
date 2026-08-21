import React from 'react';

export type DisplayState =
  | 'NOT_STARTED'
  | 'DRAFT'
  | 'SUBMITTED'
  | 'IN_REVIEW'
  | 'RETURNED'
  | 'APPROVED'
  | 'OVERDUE'
  | 'CANCELLED'
  | 'EXPIRED'
  | 'PURGED'
  | string;

interface StatusBadgeProps {
  state: DisplayState;
  isOverdue?: boolean;
  className?: string;
}

export function StatusBadge({ state, isOverdue, className = '' }: StatusBadgeProps) {
  if (isOverdue && state !== 'APPROVED' && state !== 'PURGED') {
    return (
      <span
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800 border border-red-200 ${className}`}
      >
        <span className="h-1.5 w-1.5 rounded-full bg-red-600" aria-hidden="true" />
        Overdue
      </span>
    );
  }

  switch (state) {
    case 'APPROVED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-600" aria-hidden="true" />
          Approved
        </span>
      );

    case 'IN_REVIEW':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-200 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-amber-600 animate-pulse" aria-hidden="true" />
          In Review
        </span>
      );

    case 'SUBMITTED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-blue-600" aria-hidden="true" />
          Submitted
        </span>
      );

    case 'RETURNED':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 border border-rose-200 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-rose-600" aria-hidden="true" />
          Returned
        </span>
      );

    case 'DRAFT':
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-300 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-slate-500" aria-hidden="true" />
          Draft
        </span>
      );

    case 'NOT_STARTED':
    default:
      return (
        <span
          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-600 border border-gray-200 ${className}`}
        >
          <span className="h-1.5 w-1.5 rounded-full bg-gray-400" aria-hidden="true" />
          Not Started
        </span>
      );
  }
}
