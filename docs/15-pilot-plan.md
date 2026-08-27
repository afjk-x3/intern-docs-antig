# Pilot Readiness Plan

> **Project**: InternDocs  
> **Date**: 2026-08-25  
> **Status**: Ready for execution

## Overview

This pilot validates the InternDocs MVP end-to-end using real DTR and Evaluation Paper workflows before handing the system to Makerspace for production use. The pilot uses a staging Supabase instance with test accounts — no production data.

---

## Test Accounts

| Account | Role | Purpose |
|---|---|---|
| `pilot-intern-1@makerspace.test` | intern | Primary submitter for all scenarios |
| `pilot-intern-2@makerspace.test` | intern | Second intern for isolation / cross-access checks |
| `pilot-approver-1@makerspace.test` | approver | Primary supervisor (simulates Carl) |
| `pilot-approver-2@makerspace.test` | approver | Backup supervisor for reassignment scenario |
| `pilot-admin@makerspace.test` | admin | Administrator for dashboard, invite, and reassignment |

All accounts are created via admin invite (FR-1). No self-registration.

---

## Scenario 1: Happy-Path DTR Submission → Approval → Download

**Covers**: FR-1, FR-3, FR-5, FR-6, FR-9, FR-10, FR-11, FR-17, FR-18, FR-25

| Step | Actor | Action | Pass criteria |
|---|---|---|---|
| 1.1 | Admin | Invite `pilot-intern-1` and `pilot-approver-1` via admin dashboard | Both receive invite emails; accounts are created with correct roles |
| 1.2 | Intern 1 | Accept invite, acknowledge privacy notice, set internship dates (today → +90 days) | Privacy acknowledgement recorded in DB; dates saved; checklist loads with 2 requirements |
| 1.3 | Intern 1 | Upload a sample DTR PDF (≤20 MB) against the "Daily Time Record" requirement | State changes to SUBMITTED; version 1 created with SHA-256 hash; approver notified via email |
| 1.4 | Approver 1 | Enrol signature image via canvas or PNG upload | Signature stored in `signatures` bucket; preview visible on settings page |
| 1.5 | Approver 1 | Open queue, view the DTR submission, click Approve | Approval record created (approver id, timestamp, hash, step); signature composited onto PDF server-side; state → APPROVED; intern notified via email |
| 1.6 | Intern 1 | Download the signed DTR from checklist | Signed PDF downloads via signed URL (≤5 min expiry); SHA-256 verified on download; audit log entry created |
| 1.7 | Admin | View admin dashboard | Matrix shows Intern 1's DTR as APPROVED; overall progress updates |

**Log check**: `audit_log` contains entries for: upload, approval, download.

---

## Scenario 2: Return → Resubmit → Approve (Version History)

**Covers**: FR-7, FR-12, FR-13, FR-16

| Step | Actor | Action | Pass criteria |
|---|---|---|---|
| 2.1 | Intern 1 | Upload a sample Evaluation Paper (PNG image) | State → SUBMITTED; version 1 created |
| 2.2 | Approver 1 | Return the submission with comment: "Missing supervisor name on page 2" (≥10 chars) | State → RETURNED; intern notified with comment; comment attached to version 1 |
| 2.3 | Intern 1 | View timeline modal for the submission | Timeline shows: upload event, return event with comment, current holder info |
| 2.4 | Intern 1 | Resubmit a corrected PDF | Version 2 created; version 1 marked superseded; state → SUBMITTED; returns to step 1 |
| 2.5 | Approver 1 | Approve version 2 | Signature applied to version 2; state → APPROVED; both versions visible in timeline |

**Log check**: `submission_versions` shows 2 rows (v1 superseded, v2 active). `audit_log` has return and resubmit entries.

---

## Scenario 3: Approver Reassignment (Stalled Item)

**Covers**: FR-15, FR-18

| Step | Actor | Action | Pass criteria |
|---|---|---|---|
| 3.1 | Intern 2 | Upload a DTR | State → SUBMITTED; routed to Approver 1 |
| 3.2 | Admin | Reassign the submission from Approver 1 → Approver 2 with reason: "Approver 1 is on leave this week" (≥10 chars) | `current_holder_id` updated; both approvers notified via email; audit log entry with reason |
| 3.3 | Approver 1 | Attempt to view or approve the reassigned submission | Blocked — submission no longer visible in queue (RLS enforced) |
| 3.4 | Approver 2 | Approve the submission | Approver 2's signature applied (not Approver 1's); state → APPROVED |

**Log check**: `audit_log` contains reassignment entry with reason. `approvals` row shows `approver_id` = Approver 2.

---

## Scenario 4: Cross-Intern Isolation & Adversarial Access

**Covers**: FR-2, FR-14, FR-26

| Step | Actor | Action | Pass criteria |
|---|---|---|---|
| 4.1 | Intern 2 | Attempt to access Intern 1's submission ID via direct API call (`/api/submissions/[intern1-sub-id]`) | Returns 403 or 404; no metadata or file content leaked |
| 4.2 | Intern 1 | Attempt to modify an APPROVED submission via direct Supabase client `update()` | Blocked by RLS (client UPDATE revoked on submissions); no state change |
| 4.3 | Intern 1 | Attempt to download Approver 1's signature image via direct storage path | Returns 403; signature image never served to intern role |
| 4.4 | Admin | View audit log | All denied attempts from steps 4.1–4.3 are logged |

**Log check**: `audit_log` contains denied-access entries for each adversarial attempt.

---

## Scenario 5: Admin Dashboard & CSV Export

**Covers**: FR-20, FR-21

| Step | Actor | Action | Pass criteria |
|---|---|---|---|
| 5.1 | Admin | Open admin dashboard with both interns' data present | Matrix renders in under 3 seconds; shows correct states for all submissions |
| 5.2 | Admin | Filter by requirement = "Daily Time Record" | Only DTR submissions shown |
| 5.3 | Admin | Filter by state = "APPROVED" | Only approved submissions shown |
| 5.4 | Admin | Export CSV | CSV file downloads; contains intern email, requirement name, state, approval date, approver email for each row |

---

## Pass / Fail Criteria

| Criterion | Threshold |
|---|---|
| All 5 scenarios execute without errors | **Required** |
| Every approval record has approver id + timestamp + SHA-256 hash | **Required** |
| No cross-intern data leak in scenario 4 | **Required** |
| Signed PDF renders correctly with composited signature | **Required** |
| Email notifications sent for all expected events | **Required** (verify via Resend dashboard or logs) |
| Admin dashboard renders in < 3 seconds | **Required** |
| Audit log contains entries for all security-relevant events | **Required** |
| Privacy notice blocks access until acknowledged | **Required** |

---

## Logging Instructions

During the pilot, capture evidence for each scenario:

1. **Screenshots**: Take a screenshot at each pass/fail step showing the UI state.
2. **Audit log query**: After each scenario, run:
   ```sql
   SELECT action, actor_id, target_id, target_type, created_at
   FROM public.audit_log
   ORDER BY created_at DESC
   LIMIT 20;
   ```
3. **Email delivery**: Check Resend dashboard for delivery status of each expected email.
4. **Database state**: After each scenario, run the row-count verification query from [14-backup-restore-runbook.md](./14-backup-restore-runbook.md) section 5a.

---

## Post-Pilot Sign-Off

| Item | Status | Signed by | Date |
|---|---|---|---|
| Scenario 1 passed | ☐ | | |
| Scenario 2 passed | ☐ | | |
| Scenario 3 passed | ☐ | | |
| Scenario 4 passed | ☐ | | |
| Scenario 5 passed | ☐ | | |
| All audit log entries verified | ☐ | | |
| All emails delivered | ☐ | | |
| Pilot approved for production | ☐ | | |
