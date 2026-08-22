import 'server-only';

// FR-18 Event templates. 
// Critical Rule: No document content or attachments in any email body.

export const emailTemplates = {
  submissionReceived: (reqName: string, internName: string) => `
    <p>A new submission for <strong>${reqName}</strong> has been received from ${internName}.</p>
    <p>Please log in to the InternDocs portal to review it.</p>
  `,
  
  submissionReturned: (reqName: string) => `
    <p>Your submission for <strong>${reqName}</strong> has been returned for revision.</p>
    <p>Please log in to the InternDocs portal to view the feedback and re-upload.</p>
  `,

  submissionApproved: (reqName: string, final: boolean) => `
    <p>Your submission for <strong>${reqName}</strong> has been ${final ? 'fully approved' : 'approved for this step'}.</p>
    <p>Log in to the InternDocs portal to check your updated checklist.</p>
  `,

  stepAssigned: (reqName: string) => `
    <p>You have been assigned to review a submission for <strong>${reqName}</strong>.</p>
    <p>Please log in to the InternDocs portal to review.</p>
  `,

  stepReassigned: (reqName: string, reason: string) => `
    <p>A submission for <strong>${reqName}</strong> previously assigned to you has been reassigned to another approver.</p>
    <p>Reason: <em>${reason}</em></p>
  `,

  deletionWarning: (reqName: string, daysRemaining: number) => `
    <p><strong>Warning: Data Retention Policy</strong></p>
    <p>Your document for <strong>${reqName}</strong> is scheduled for permanent deletion in ${daysRemaining} days according to the retention policy.</p>
    <p>If you need a copy of this document, please log in to the InternDocs portal and download it before the deadline.</p>
  `,
  
  dailyReminderApprover: (count: number) => `
    <p>You have <strong>${count}</strong> submissions pending your review that are past their SLA.</p>
    <p>Please log in to the InternDocs portal to address them.</p>
  `,

  dailyReminderAdmin: (internEmail: string, reqName: string) => `
    <p><strong>Admin Escalation:</strong></p>
    <p>A submission for <strong>${reqName}</strong> by ${internEmail} has been pending approval for more than 5 working days.</p>
    <p>Please log in to the InternDocs admin portal to follow up or reassign.</p>
  `,
};
