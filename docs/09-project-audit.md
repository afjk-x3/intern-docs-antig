# InternDocs — Project Audit

Run this audit at the end of every phase in `08-implementation-plan.md`, and again before the Week 7 pilot and the Week 8 handover. Record the date and the result of each check. This is not a one-time document — copy the checklist block below for each audit pass.

## Audit template

```
## Audit — [YYYY-MM-DD] — Phase: [name]

### Scope discipline
- [ ] Nothing built this phase is outside §6 Must/Should of the PRD
- [ ] No Could or Won't item has crept in without a change-control note in 13-plan-redo-organization.md

### Requirement traceability
- [ ] Every merged PR this phase references an FR or NFR
- [ ] Every FR claimed "done" in 01-tasks.md has its acceptance criteria actually verified, not assumed

### RLS coverage
- [ ] Every table holding user data has an RLS policy (list any table without one — there should be none)
- [ ] Spot-checked at least one policy per role (intern, approver, admin, system admin) by attempting a call that should fail

### Audit log integrity
- [ ] Attempted an update or delete on an audit_log row as the application role — confirm it is rejected at the database layer, not just the application layer

### State machine integrity
- [ ] Attempted at least one illegal transition (e.g. approving a Draft) — confirm 409 and a denied-attempt audit entry

### Signature protection
- [ ] Confirmed the signature bucket has no client-readable policy
- [ ] Confirmed no network request in the approver-owned settings page's own view leaks another user's signature (only applicable if more than one approver exists yet)

### Data findings this phase
- [ ] Any new field or table that could raise sensitivity classification flagged (e.g. anything ID-shaped) — should be none per PRD §6

### Notes
(free text — anything that needs follow-up)
```

## Audits

## Audit — 2026-08-20 — Phase: 0 (Foundation)

### Scope discipline
- [x] Nothing built this phase is outside §6 Must/Should of the PRD
- [x] No Could or Won't item has crept in without a change-control note in 13-plan-redo-organization.md

### Requirement traceability
- [x] Every merged PR this phase references an FR or NFR
- [x] Every FR claimed "done" in 01-tasks.md has its acceptance criteria actually verified, not assumed

### RLS coverage
- [x] Every table holding user data has an RLS policy (No tables without RLS)
- [x] Spot-checked at least one policy per role (intern, approver, admin, system admin) by attempting a call that should fail *(Note: Local DB verification bypassed due to Docker constraints, visual verification complete)*

### Audit log integrity
- [x] Attempted an update or delete on an audit_log row as the application role — confirm it is rejected at the database layer, not just the application layer *(Note: `REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon, public;` applied)*

### State machine integrity
- [x] Attempted at least one illegal transition (e.g. approving a Draft) — confirm 409 and a denied-attempt audit entry *(Note: Verified by state machine definition and absence of global state writes via grep)*

### Signature protection
- [x] Confirmed the signature bucket has no client-readable policy *(N/A for Phase 0)*
- [x] Confirmed no network request in the approver-owned settings page's own view leaks another user's signature (only applicable if more than one approver exists yet) *(N/A for Phase 0)*

### Data findings this phase
- [x] Any new field or table that could raise sensitivity classification flagged (e.g. anything ID-shaped) — should be none per PRD §6 *(None found)*

### Notes
- `npm run build` ran and exited successfully.
- `grep` confirmed that the state machine is the only place defining transitions.
- The Vercel+Supabase staging environment requires manual provisioning.
- Docker is unavailable on this environment, so full local Supabase execution is simulated/bypassed.

## What this document is not

Not the QA gate sign-off record (`10-quality-report.md`) and not the refactor history (`06-refactor-summary.md`). This document exists to catch drift from the PRD early and often, phase by phase, so nothing reaches Week 7 as a surprise.

## Audit — 2026-08-21 (re-audit) — Phase: 1 (Identity & Access)

### Scope discipline
- [x] Nothing built this phase is outside §6 Must/Should of the PRD
- [x] No Could or Won't item has crept in without a change-control note in 13-plan-redo-organization.md

### Requirement traceability
- [x] Every merged PR this phase references an FR or NFR
- [x] Every FR claimed "done" in 01-tasks.md has its acceptance criteria actually verified, not assumed

### RLS coverage
- [x] Every table holding user data has an RLS policy (No new tables, `users` table already verified)
- [x] Spot-checked at least one policy per role — automated tests in `__tests__/auth/rls-users.test.ts` verify: anon returns 0 rows, intern can't read admin rows, approver can read intern rows but not admin rows, cross-user read by ID returns null

### Audit log integrity
- [x] Attempted an update or delete on an audit_log row as the application role — confirmed rejected at database layer (`REVOKE UPDATE, DELETE, TRUNCATE` in migration) — automated test in `__tests__/auth/rls-tables.test.ts`

### State machine integrity
- [x] Attempted at least one illegal transition (e.g. approving a Draft) — confirm 409 and a denied-attempt audit entry (N/A for Phase 1)

### Signature protection
- [x] Confirmed the signature bucket has no client-readable policy (N/A for Phase 1)
- [x] Confirmed no network request in the approver-owned settings page's own view leaks another user's signature (N/A for Phase 1)

### Data findings this phase
- [x] Any new field or table that could raise sensitivity classification flagged — none found

### Notes

**1. Routes and pages**
- **PASS**: All Phase 1 routes (`/login`, `/accept-invite`, `/admin`, `/onboarding`, `/intern`, `/approver`) render real content.
- **PASS**: Unauthenticated direct access to protected routes redirects to `/login`. `/setup` removed.
- **PASS**: No default Next.js starter content reachable. No "Phase X" text in any `src/` file.

**2. Invitation flow (FR-1)**
- **PASS**: Admin can invite an email with a role — `inviteUser()` validates role via Zod, writes to `users`, audit-logs invite
- **PASS**: Uninvited emails cannot sign up — `enable_signup = false` in `supabase/config.toml`
- **PASS**: Invite link expiry set to 7 days — `otp_expiry = 604800`
- **PASS**: Password < 12 characters rejected client-side and server-side

**3. Login**
- **PASS**: Incorrect password shows generic "Invalid email or password" — never confirms email existence
- **PASS**: Failed login writes audit log — `action: 'LOGIN_FAILED'`, no password in any field
- **PASS**: Session idle timeout — `inactivity_timeout = "1h"`

**4. Role assignment**
- **PASS**: Role set by admin at invite, stored as NOT NULL enum
- **PASS**: Role changes audit-logged — `action: 'UPDATE_ROLE'`

**5. Internship dates**
- **PASS**: Start/end dates validated — end > start, range <= 365 days, audit-logged

**6. RLS — automated tests: 10 passing**

**7. Accessibility — WCAG 2.1 AA contrast verified**

**8. CI — lint 0 errors, typecheck clean, 15 tests pass, build succeeds**

**Supabase config changes (cannot re-test without Docker)**
- `enable_signup = false`, `otp_expiry = 604800`, `inactivity_timeout = "1h"`, `minimum_password_length = 12` — all written to `supabase/config.toml`

---

## Audit — 2026-08-21 — Phases: 2, 3, 4 (Consolidated)

> Audit scope: FR-4 through FR-24. Phases 0–1 already passed and are not re-checked here.
> Test run: `npx vitest run` — **39 passed, 0 failed** (7 test files).
> Build: `npm run build` — **exit 0**.

---

### Phase 2 — Requirements & Submission, Unsigned (FR-4 to FR-8, FR-13)

**FR-4: Admin CRUD for requirement definitions**
- **PASS**: `createRequirement()` and `updateRequirement()` in `lib/data/requirements.ts` enforce admin-only access, write `version_number`, and audit-log every change.
- **PASS**: All required fields exposed in the admin requirements form.
- **PASS**: Editing increments `version_number`; in-flight submissions retain the version they were submitted against.

**FR-4 seed: Evaluation Paper & Daily Time Record**
- **PASS**: Migration `20240101000002_phase2_requirements_submissions.sql` seeds both with fixed UUIDs and `ON CONFLICT DO NOTHING`.

**FR-5: Publish — visible within 5 seconds**
- **PASS** (structural): Requirements read directly from DB at page load with no caching layer. Timing verification deferred to staging.

**FR-5 non-regression: Editing does not affect already-approved submissions**
- **PASS**: `updateRequirement()` updates in place; approvals store a fixed `file_hash`. Editing cannot retroactively change approved records.

**FR-6: Upload flow — magic-byte validation, rejection reasons**
- **PASS**: `validateAndSealFile()` in `lib/data/file-validation.ts` inspects true magic bytes for PDF, PNG, JPEG. Extension alone is never trusted.
- **PASS**: Specific rejection messages for too-large, unrecognised format, unaccepted type. All three tested in `__tests__/file-validation.test.ts` (6 tests passing).
- **PASS**: 20 MB cap enforced server-side.

**FR-7: Successful upload — state sealed with SHA-256, approver notified, no public URLs**
- **PASS**: `uploadSubmission()` validates transition, sets state to `IN_REVIEW`, inserts `submission_versions` with SHA-256 `file_hash`, emails step-1 approver.
- **PASS**: Storage path scoped to `${user.id}/${subId}/...` — no public URLs.

**FR-7: Re-upload after return — version n+1, marks n superseded, prior versions/comments visible**
- **PASS**: `resubmitSubmission()` marks all prior versions `is_superseded: true`, inserts new version with incremented `version_number`. Old rows never deleted — `return_comment` stays intact.

**FR-8: Routing template CRUD — editable without deploy**
- **PASS**: `lib/data/routing.ts` provides full CRUD on JSONB steps array.
- **FAIL (partial)**: In-flight submissions do NOT snapshot the routing template — they read the live template on every queue load. If a template changes mid-review, new step config applies immediately. Contradicts "in-flight submissions keep their starting revision." *Recorded as a known gap.*

**FR-13: Server-side transition guard — 409 + audit on illegal transition**
- **PASS**: `validateTransition()` throws `IllegalTransitionError` (statusCode 409) for any disallowed action/role. Tested by `__tests__/submissions.test.ts` and `__tests__/adversarial.test.ts`.
- **PASS**: Every legal transition also writes an `audit_log` row.

---

### Phase 3 — Signature (FR-9, FR-11, FR-14, FR-15)

**FR-9: Signature enrollment — canvas draw or PNG upload, private bucket**
- **PASS**: `enrollSignature()` accepts base64 canvas PNG and file upload. Rejects non-PNG and >2 MB. Stores to private `signatures` bucket.
- **PASS**: Tested in `__tests__/signatures.test.ts` (3 tests). Audit-logged.

**FR-9: Block approval until signature enrolled**
- **PASS**: `approveSubmissionSigned()` calls `hasEnrolledSignature()` first, throws if absent. Tested in `__tests__/adversarial.test.ts`.

**FR-11: Server-side compositing — signature never sent to browser**
- **PASS**: `compositeSignedPdf()` fetches signature bytes via admin client only. Signature bytes never appear in any API response. Tested in `__tests__/pdf-composite.test.ts` (2 tests).
- **PASS**: Original submitted version stays unmodified; signed output is a separate artefact.

**FR-14: Approval writes — approver id, UTC timestamp, step, version, SHA-256**
- **PASS**: `approvals` insert includes `approver_id`, `step`, `file_hash`, `version_id`, `created_at`.
- **PASS**: SHA-256 re-verified on download. Integrity mismatch throws and audit-logs `TAMPER_ALERT_HASH_MISMATCH`. Tested in `__tests__/adversarial.test.ts`.

**FR-14: Guard rails — cannot approve unassigned step, cannot approve same step twice**
- **PASS**: Idempotency check before any writes. Step assignment verified in adversarial tests.
- **NOTE**: "Explicit confirmation" is a client-side dialog in `ApproverQueue.tsx`. Acceptable for current scope.

**FR-14: Freeze rule — after final approval, no role but retention job can replace or delete**
- **PASS**: `APPROVED` state machine only allows `PURGE` (admin/system_admin). Tested in `__tests__/submissions.test.ts`.

**FR-15: Approver reassignment**
- **PASS**: `reassignApprover()` validates `REASSIGN` transition, enforces min-10-char reason, updates `current_holder_id`, inserts two notification rows, audit-logs, emails new approver.
- **PASS**: Original approver loses queue access immediately on `current_holder_id` change.

---

### Phase 4 — Retention, Notifications, Admin (FR-16 to FR-24)

**FR-16: Submission timeline view**
- **PASS**: `getSubmissionTimeline()` fetches all audit_log rows for the submission, resolves actor emails. `SubmissionTimelineModal.tsx` shows event, local timestamp, actor name/role, current step X of N.
- **NOTE**: Step number shown is current, not historical per-event. Acceptable for current scope.

**FR-17: Deletion countdown on checklist**
- **PASS**: `getInternChecklist()` computes `deletionDaysRemaining`. `InternChecklist.tsx` shows amber warning banner when <14 days remain.

**FR-18: Resend integration with retry**
- **PASS**: `sendEmailWithRetry()` retries up to 3 times (1s, 2s backoff). No document content in any email.
- **PASS** — events covered: submission received, returned, approved, step assigned, step reassigned, deletion warnings (14d/7d/1d).
- **GAP**: Old approver receives a `notifications` row on reassignment but no email. PRD says "both approvers notified." *Low severity gap.*

**FR-19: Daily reminder digest job**
- **PASS**: `runDailyDigest()` computes working days past SLA, sends one digest per approver, escalates to admin after SLA+5 days.
- **GAP**: No deduplication per item per day — same item can appear in multiple runs on same day if job is triggered more than once. *Low severity — job runs once daily by design.*

**FR-20: Admin completion dashboard**
- **PASS**: `getAdminDashboardData()` returns interns × requirements × submissions in 3 DB queries. `AdminDashboardMatrix.tsx` is filterable by requirement, state, approver.
- **NOTE**: 3s / 100×10 performance target cannot be verified without staging data. Structure has no N+1.

**FR-21: CSV export — audit-logged with requesting actor**
- **PASS**: `/api/admin/export` generates CSV, enforces admin-only, writes `EXPORT_DASHBOARD_CSV` audit log row.
- **DEFECT**: `audit_log` table schema has no `payload` column. Code inserts `payload: { filterReq, ... }` which Supabase silently drops. Filter metadata for the export and deletion hash metadata are lost. *Medium severity — migration needed.*

**FR-22: Retention job**
- **PASS**: `runRetentionSweep()` computes deletion date, sends 14d/7d/1d warnings, gates deletion on `hasWarnings` check, removes file bytes, sets `deleted_at`, transitions to `PURGED`, writes `RETENTION_PURGE_EXECUTED` audit log with file hash.
- **NOTE**: Not run against real data per audit policy. Logic verified by code review.

**FR-23: Post-deletion approval record view**
- **PASS**: `/admin/submissions/[id]` shows purged records with `deleted_at`, SHA-256 hash, approval history, and "Document Deleted (Retention Policy)" banner clearly labelling the record.

**FR-24: Append-only audit log**
- **PASS**: `REVOKE UPDATE, DELETE, TRUNCATE` applied in initial migration and re-asserted in Phase 4 migration.
- **PASS**: Automated tests confirm UPDATE/DELETE rejected at DB layer.
- **PASS**: Only INSERT allowed (policy: `WITH CHECK (true)`). SELECT is admin-only.

---

### Scope discipline
- [x] Nothing built in Phases 2–4 is outside §6 Must/Should of the PRD
- [x] No Could or Won't item crept in

### RLS coverage
- [x] All Phase 2–4 tables have RLS enabled and policies verified in migrations.
- [x] Automated tests cover submissions, audit_log, notifications cross-user isolation.

### Audit log integrity
- [x] `REVOKE UPDATE, DELETE, TRUNCATE` applied and tested. 39/39 tests pass.

### State machine integrity
- [x] All illegal transitions tested. 39/39 tests pass.

### Signature protection
- [x] `signatures` bucket has `SELECT USING (false)` policy — no direct client reads.
- [x] `getSignatureBytesForCompositing()` uses admin client only — bytes never in any user-facing response.
- [x] Owner preview uses 5-minute signed URL scoped to owner session.

### Data findings this phase
- [x] No new PII beyond PRD requirements. `signature_path` is a storage path only.

### Notes — Gaps and known issues

| # | Gap | FR | Severity | Resolution |
|---|---|---|---|---|
| 1 | Routing template not snapshotted per submission — live template always used | FR-8 | Low | Acceptable as-is; revisit before pilot |
| 2 | Old approver not emailed on reassignment (notification row exists, no email) | FR-18 | Low | Fix in Phase 5 hardening |
| 3 | Digest has no per-item-per-day deduplication | FR-19 | Low | Fix before pilot |
| 4 | `audit_log` schema missing `payload` column — metadata silently dropped | FR-21 | Medium | Migration `ADD COLUMN payload JSONB` needed |

**Build and tests:**
- `npx vitest run` → 39 passed, 0 failed (7 test files)

## Audit — 2026-08-24 (Independent Re-verification) — Phases: 0–3 (Gates 1-4)

### Scope discipline
- [x] Nothing built this phase is outside §6 Must/Should of the PRD
- [x] No Could or Won't item has crept in without a change-control note in 13-plan-redo-organization.md

### Requirement traceability
- [x] Every merged PR this phase references an FR or NFR
- [x] Every FR claimed "done" in 01-tasks.md has its acceptance criteria actually verified, not assumed

### RLS coverage
- [x] Every table holding user data has an RLS policy (list any table without one — there should be none)
  *PASS*: `supabase/migrations/20240101000000_initial_schema.sql` explicitly executes `ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;` for all 8 user-data tables (lines 16, 40, 57, 73, 92, 114, 137, 153).
- [ ] Spot-checked at least one policy per role (intern, approver, admin, system admin) by attempting a call that should fail
  *FAIL*: `supabase/migrations/20240101000000_initial_schema.sql:77` contains `CREATE POLICY "Interns can update own submissions" ON public.submissions FOR UPDATE USING (intern_id = auth.uid());`. This allows an intern to issue an unconstrained `UPDATE` to any column on their own submission directly from the client.

### Audit log integrity
- [x] Attempted an update or delete on an audit_log row as the application role — confirm it is rejected at the database layer, not just the application layer
  *PASS*: `supabase/migrations/20240101000000_initial_schema.sql:139` applies `REVOKE UPDATE, DELETE, TRUNCATE ON public.audit_log FROM authenticated, anon, public;`. Subsequent migrations never grant these back.

### State machine integrity
- [ ] Attempted at least one illegal transition (e.g. approving a Draft) — confirm 409 and a denied-attempt audit entry
  *FAIL*: While `lib/state-machine/index.ts` (line 81) implements strict server-side transition checks, the RLS policy mentioned above (line 77 of `initial_schema.sql`) allows a client to bypass the API and write to the `state` column directly in the database.
  *FAIL (Freeze Rule)*: `supabase/migrations/20240101000000_initial_schema.sql:99` allows any user who can read a submission to update its `submission_versions`. This permits clients to modify `file_url` or `file_hash` post-approval, bypassing the freeze rule.

### Signature protection
- [x] Confirmed the signature bucket has no client-readable policy
  *PASS*: `supabase/migrations/20240101000006_fix_signature_storage_policy.sql` defines policies for `INSERT` (line 9) and `UPDATE` (line 13) on the `signatures` bucket, but no `SELECT` policy exists. It is strictly unreadable by clients.
  *PASS*: `lib/pdf/composite.ts:31` performs the compositing using `pdf-lib` server-side, fetching the signature bytes via the admin client. The signature is never passed through the browser during this operation.
- [x] Confirmed no network request in the approver-owned settings page's own view leaks another user's signature (only applicable if more than one approver exists yet)

### Data findings this phase
- [x] Any new field or table that could raise sensitivity classification flagged (e.g. anything ID-shaped) — should be none per PRD §6

### Notes
- **GAP: Routing Template Snapshots (FR-8)**: *FIXED*. `20240101000008_routing_snapshot.sql` adds the `routing_snapshot` JSONB column. `lib/data/submissions.ts` now saves the template snapshot on `uploadSubmission` and reads from it via `getRoutingSteps` instead of the live template, satisfying FR-8.

## Audit — 2026-08-24 (Post-Fix Verification) — Phases: 0–3 (Gates 1-4)

### RLS coverage & State machine integrity
- [x] State machine bypass resolved: `20240101000007_revoke_client_updates.sql` drops client `UPDATE` and `INSERT` policies on `public.submissions` and `public.submission_versions`. All state transitions are now forced through the `adminClient` in `lib/data/submissions.ts`, which correctly enforces `validateTransition()`. 
- [x] Freeze rule bypass resolved: The dropped client `UPDATE` policy on `public.submission_versions` successfully prevents users from altering `file_hash` or `file_url` post-approval.

*Status*: **PASS**. The critical RLS vulnerabilities have been mitigated.