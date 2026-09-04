'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { AdminInviteForm, type RoleOption } from '@/components/AdminInviteForm';

interface AdminInviteModalProps {
  onInviteAction: (formData: FormData) => Promise<{ success?: boolean; error?: string; inviteLink?: string | null }>;
  allowedRoles?: RoleOption[];
  existingSchools?: string[];
  existingBatches?: string[];
}

/**
 * Manual invite, behind a floating trigger instead of a permanent form on the page.
 *
 * Self-registration (RegisterForm -> registerInternWithPassword) is now the primary way an
 * intern gets an account; an admin sending a manual invite is the fallback for the cases
 * that don't fit self-registration (HR asks for one directly), not the everyday path. The
 * trigger reuses the pill-button styling the old "Pending Registrations" trigger used
 * (PendingRegistrationsModal, removed when /admin/users became a single cohort table) --
 * same shape, amber pill, top-right of the page header -- just relabelled.
 */
export function AdminInviteModal({
  onInviteAction,
  allowedRoles,
  existingSchools = [],
  existingBatches = [],
}: AdminInviteModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();

  // The invited intern's row needs to show up in AdminUsersTable below without a manual
  // page reload -- mirrors the refresh AdminUsersTable itself does after Approve.
  const handleInvite = async (formData: FormData) => {
    const res = await onInviteAction(formData);
    if (!res.error) router.refresh();
    return res;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 font-semibold text-xs transition-all shadow-2xs hover:shadow-xs active:scale-[0.99]"
      >
        <svg className="h-4 w-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        <span>Invite Intern</span>
      </button>

      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Invite Cohort Intern</DialogTitle>
          <DialogDescription>
            Manual fallback for interns who can&apos;t use self-registration. Most interns
            should sign up themselves and be admitted from the Approve action in the table below.
          </DialogDescription>
        </DialogHeader>

        <AdminInviteForm
          onInviteAction={handleInvite}
          allowedRoles={allowedRoles}
          existingSchools={existingSchools}
          existingBatches={existingBatches}
          embedded
        />
      </DialogContent>
    </Dialog>
  );
}
