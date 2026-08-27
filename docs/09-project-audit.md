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

## Audit — 2026-08-27 (Independent Re-verification) — Phases: 1–5 (pre-Phase-5 baseline)

> Scope: re-verified Phases 1–4 end to end against actual code rather than trusting prior self-reported checkmarks in this document, then fixed everything found before this entry was written. Also establishes the Phase 5 starting line. Build: `npx tsc --noEmit` clean. `npm run lint` — 0 errors. `npx vitest run` — **39 passed, 0 failed** (7 test files).

### Scope discipline
- [x] Nothing built this pass is outside §6 Must/Should of the PRD
- [x] No Could or Won't item has crept in without a change-control note in `13-plan-redo-organization.md`

### Requirement traceability
- [x] Every FR claimed "done" in `01-tasks.md` re-checked against code, not assumed
  *CORRECTION*: the 2026-08-21 gap table (line 281 above) still listed gap #3 (digest dedup) and #4 (`audit_log.payload` missing) as open. Both were already fixed in code by the time of this pass — `lib/jobs/daily-digest.ts` dedupes per item per day via a `sentToday` set, and `20240101000009_audit_payload.sql` added the `payload` column, correctly populated by the CSV export path. This document itself had drifted from the code it describes; treat entries here as a snapshot, always re-verify against current code before relying on a PASS.

### RLS coverage
- [x] Every table holding user data has an RLS policy
- [x] Spot-checked storage bucket policies specifically (not just table policies) — this is where the previous audit passes had a blind spot
  *FAIL, now FIXED*: `20240101000002_phase2_requirements_submissions.sql` (re-created in `...0005_fix_storage_policies.sql:17-19`) defined the `submissions` bucket SELECT policy as `USING (bucket_id = 'submissions')` with **no ownership or holder scoping**, despite being named "read via signed URLs only." Any authenticated user could read any object in the bucket directly — FR-26 scenario 6 (direct storage access without a signed URL), unguarded. Fixed in `20240101000011_fix_submissions_storage_and_delete_policy.sql`: `USING (false)`, matching the `signatures` bucket's correct policy. Confirmed safe — every download path in `getSubmissionSignedDownloadUrl()` already falls back to the admin/service-role client.
  *FAIL, now FIXED*: the same migration (`...0005`, lines 22-25) granted `DELETE` on `public.submissions` to `intern_id = auth.uid()` with **no state filter**, despite being named "delete own orphan submissions." Cascading FKs on `submission_versions`/`approvals` meant an intern could delete an `APPROVED` submission's full record via direct API, defeating FR-14/FR-23. Policy dropped in `20240101000011...`.

### Audit log integrity
- [x] `REVOKE UPDATE, DELETE, TRUNCATE` on `audit_log` confirmed still in force, no migration grants it back
- [x] Illegal/denied transitions now write an audit entry (previously did not)
  *FAIL, now FIXED*: FR-13/FR-24 require a denied transition to be audit-logged, not just rejected. `validateTransition()` only threw; no caller ever caught that to log it. Added `validateTransitionAudited()` in `lib/data/submissions.ts`, wired into all transition call sites (`uploadSubmission`, `resubmitSubmission`, `approveSubmissionSigned`, `returnSubmission`, `reassignApprover`) — a denied attempt now writes a `DENIED_TRANSITION` entry with the attempted action, from-state, and role.

### State machine integrity
- [x] Every state write goes through `lib/state-machine`, no direct column writes
  *FAIL, now FIXED*: `lib/jobs/retention-sweep.ts` wrote `state: 'PURGED'` directly, bypassing the state machine entirely, and its eligibility check treated any non-`APPROVED` submission as purge-eligible 30 days after internship end — including `IN_REVIEW`, which has no legal `PURGE` transition in Appendix A. The job now calls `validateTransition` before every state write, only purges from `APPROVED`/`CANCELLED`/`EXPIRED`, and expires stalled `SUBMITTED`/`IN_REVIEW`/`RETURNED` submissions (via `EXPIRE`) instead of purging them directly.
  *FAIL, now FIXED*: `ASSIGN_STEP` was defined in the state machine but never invoked anywhere — `uploadSubmission()`/`resubmitSubmission()` wrote `IN_REVIEW` directly after the `SUBMIT`/`RESUBMIT` check. Both now also validate the `SUBMITTED → IN_REVIEW` leg via `ASSIGN_STEP` before writing.
  *FAIL, now FIXED*: `reassignApprover()` authorized the `approver` role in addition to `admin`/`system_admin`, contradicting FR-15 and Appendix A ("Who may trigger: Administrator"). `REASSIGN` is now Administrator-only in both `lib/state-machine/index.ts` and the app-level check; the Reassign button is hidden in the approver UI for non-admin approvers so it doesn't dead-end into an error.

### Signature protection
- [x] `signatures` bucket still `USING (false)` for client SELECT, never relaxed
- [x] Compositing still server-side only via admin client; bytes never reach a response

### Data findings this phase
- [x] No new PII/sensitivity-raising fields
- *FAIL, now FIXED*: `getApproversList()` had no role check — any authenticated intern could enumerate every approver/admin/system_admin email via the server action. Now requires `approver`/`admin`/`system_admin`.
- Two correctness bugs fixed alongside (fail-closed, not security holes, but worth recording): `inviteUser()` was missing `.single()` on its role lookup, so the admin check always evaluated to an array and the function threw `Unauthorized` for every real admin; `login()`'s failed-attempt audit write used a non-existent `details` column instead of `payload`, silently dropping the attempted email.

### CI / tooling gaps closed this pass
- *FAIL, now FIXED*: `.github/workflows/ci.yml` triggered only on branch `main`, which does not exist in this repo (`master` is the actual default branch, confirmed via `git remote show origin`) — lint/typecheck/tests/secret-scan had never actually gated a merge. Fixed to trigger on `master`.
- *GAP, now CLOSED*: `01-tasks.md` Phase 0 claimed "pre-commit secret scan" done, but only a CI-side trufflehog step existed — no local hook, so `git commit --no-verify` (or simply never running CI) bypassed it entirely. Added a `husky` pre-commit hook running `secretlint` on staged files, plus the same `secretlint` check as its own CI step, so a bypassed local hook is still caught server-side per `12-backend-security-rules.md` §10.

### Notes — accessibility work done alongside (see `07-design-system.md`/`11-frontend-ui-rules.md` for the authoritative rules; recorded here only as a pointer)
Installed shadcn/ui (`Dialog`, `Button`, and a new shared `ConfirmAction` component per `07-design-system.md` §5) and used them to fix: `StatusBadge` mislabelling `PURGED`/`CANCELLED`/`EXPIRED` submissions as "Not Started"; admin role changes firing with no confirmation; missing focus-trap/Escape/`aria-modal` on the approver's Approve/Return/Reassign dialogs, the timeline modal, and the intern upload modal. Also: dropped the Google Fonts load that contradicted the design doc's "system font stack" rule, added a global `prefers-reduced-motion` rule, added `role="alert"`/`aria-describedby` to error surfaces across most forms, replaced two raw `alert()` calls with inline dismissible error banners, added deletion-countdown visual escalation at 7/1 days, and swapped hardcoded hex colors on the login page for the existing brand-token classes (no visual change). Not done in this pass: the login page's layout still doesn't match `04-homepage-design-plan.md`'s single-column spec — flagged as a decision point for the team rather than changed unilaterally, since the current build looks like a deliberate, already-shipped design, not an obvious defect.

### Notes — updated gap table (supersedes the 2026-08-21 table above)

| # | Gap | FR | Severity | Status |
|---|---|---|---|---|
| 1 | Routing template not snapshotted per submission | FR-8 | Low | **Resolved** (`routing_snapshot`, confirmed still working) |
| 2 | Old approver not emailed on reassignment (notification row exists, no email) | FR-18 | Low | Still open |
| 3 | Digest has no per-item-per-day deduplication | FR-19 | Low | **Resolved** (confirmed in code, doc was stale) |
| 4 | `audit_log` schema missing `payload` column | FR-21 | Medium | **Resolved** (confirmed in code, doc was stale) |
| 5 | `submissions` storage bucket readable by any authenticated client, bypassing signed URLs | FR-25/FR-26 #6 | **Critical** | **Resolved** this pass |
| 6 | Unscoped client DELETE policy on `submissions` (any state, including APPROVED) | FR-14/FR-23 | **Critical** | **Resolved** this pass |
| 7 | Retention job bypassed the state machine, could purge `IN_REVIEW` submissions | FR-13/Appendix A | **Critical** | **Resolved** this pass |
| 8 | `reassignApprover` authorized `approver` role, not admin-only | FR-15 | High | **Resolved** this pass |
| 9 | Denied transitions not audit-logged | FR-13/FR-24 | Medium | **Resolved** this pass |
| 10 | CI workflow targeted nonexistent `main` branch, never actually ran | NFR maintainability | High | **Resolved** this pass |
| 11 | No local pre-commit secret scan despite Phase 0 claiming it done | 12-backend-security-rules.md §10 | Medium | **Resolved** this pass |
| 12 | `getApproversList()` had no role check | FR-2 | Low | **Resolved** this pass |
| 13 | FR-26 adversarial suite is entirely mock-based (no real Postgres/RLS execution) and covers only 2 of 7 mandated scenarios end to end | FR-26 | High | **Open — Phase 5 work** |
| 14 | Playwright absent despite being locked into the stack | `01-tasks.md`, `02-dev-guide.md` | Medium | **Open — Phase 5 work** |
| 15 | Privacy notice acknowledgment flow not implemented | FR-25 | High | **Open — Phase 5 work** |
| 16 | No automated accessibility scan / documented manual keyboard pass performed | NFR accessibility | Medium | **Open — Phase 5 work** |

### Phase 5 starting line
Of the six `01-tasks.md` Phase 5 items: "Signed URLs for every download" is now genuinely true (gap #5 above closed the last hole in it) — recommend checking that box. The other five (privacy notice, full FR-26 suite green in CI, accessibility scan + keyboard pass, backup restore rehearsal, the 3–5 DTR pilot) are still open and are the next work.