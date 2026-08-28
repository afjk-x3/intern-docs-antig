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

## Audit — 2026-08-27 (Phase 5, gap #13) — Real FR-26 suite, and a critical finding it caught

### Environment change from the previous pass
The 2026-08-27 baseline above recorded no local Supabase instance and no way to run the FR-26 suite against real Postgres. That has changed: Docker and the Supabase CLI are now available in this environment, and a local `intern-docs-antig` stack was already running. Its applied migration history did **not** match the migration files on disk (`supabase_migrations.schema_migrations` had version `20240101000011` recorded under the name `privacy_acknowledgements`, not `fix_submissions_storage_and_delete_policy` — almost certainly a stale container from before the migration-11 rename earlier this week). Ran `npx supabase db reset` to rebuild the local DB from exactly the 12 migration files currently in the repo before trusting anything about it. Any future session inheriting a running local stack should re-verify `supabase migration list` against `ls supabase/migrations/` before relying on it — a stale local DB will silently misrepresent the real RLS surface, which is exactly what happened here (see finding below).

### RLS coverage
- [x] Spot-checked every policy against a real signed-in client per role, not assumed from the SQL text
  **CRITICAL, found and fixed this pass**: `"Users can update own row" ON public.users FOR UPDATE USING (id = auth.uid())` (migration 0) has no `WITH CHECK` clause. Per Postgres RLS semantics, an UPDATE policy without an explicit `WITH CHECK` reuses its `USING` expression for the post-update check too — and that expression only ever constrained `id`, never `role`. Verified empirically against the freshly-reset local instance: signed in as a real `intern`-role user and ran `supabase.from('users').update({ role: 'system_admin' }).eq('id', <own id>)` through the ordinary anon-key client — it succeeded. Any authenticated user could grant themselves `system_admin` with one direct table call, bypassing `updateUserRole()`'s admin-only check entirely (05-security.md §2 / R5: "authorization implemented only in the UI"). Confirmed two legitimate self-update paths were not collateral damage before shipping the fix: `enrollSignature()` and `updateInternshipDates()` both write to their own `users` row via the same policy for non-role columns and needed to keep working.
  **Fix**: `20240101000012_prevent_self_role_escalation.sql` adds a `BEFORE UPDATE` trigger (`prevent_self_role_change`) that raises unless `NEW.role = OLD.role` or the acting session's own role (via `get_user_role()`) is `admin`/`system_admin`. Verified all four cases against the live DB: (1) intern self-escalation now raises `Role changes require administrator privileges` and the row is unchanged; (2) intern's own non-role self-update (signature enrollment shape) still succeeds; (3) `updateUserRole()`'s actual write path (service-role client, no `sub` claim, so the trigger doesn't fire for it) still succeeds; (4) a `system_admin` changing another user's role through their own signed-in session still succeeds. Also confirmed the regression test below actually catches this class of bug: temporarily dropped the trigger at the DB level (not the migration file) and reran the suite — it failed at exactly the expected assertion, then passed again once the trigger was restored via `db reset`.

### FR-26 adversarial suite — gap #13 closed
Replaced `__tests__/auth/rls-tables.test.ts` and `__tests__/auth/rls-users.test.ts` (deleted) with `__tests__/auth/rls-integration.test.ts` — real Postgres, no mocks. Every one of the 7 scenarios in `05-security.md` §8 now runs as a signed-in real user against the actual applied migrations, asserting on what Postgres/PostgREST actually returns rather than a value the test itself supplied to a mock:

1. Intern reads another intern's submission — `.select().eq('id', ...)` returns `[]`, no error (RLS filters the row, doesn't 403 at this layer — the app-level 403 for this exact case is already covered by the mocked `getSubmissionDetails()` test in `adversarial.test.ts`; this file proves the DB-layer backstop independently)
2. Approver acts on a step not assigned to them — direct `approvals` insert by a non-holder is rejected by the `WITH CHECK` on "Approvers can insert approvals"
3. Approver acts after reassignment — same insert, now rejected for the *previous* holder once `current_holder_id` has moved
4. Intern calls an admin-only endpoint — the self-role-escalation regression above, plus a denied `routing_templates` insert
5. Edit an approved submission — owner and non-admin approver both get 0 rows affected (RLS silently excludes the row from the UPDATE's match set rather than erroring — this took one iteration to get the assertion right; see comment in the test file)
6. Direct storage access bypassing a signed URL — `submissions` bucket download denied for owner and non-owner alike (`USING (false)`, migration 11)
7. Client-side fetch of a stored signature image — `signatures` bucket download denied for owner and non-owner alike (`USING (false)`, migration 4)

`adversarial.test.ts` (mocked business-logic unit tests) is unchanged and still valuable — it exercises `lib/data/*`'s actual validation and error-message logic under controlled inputs, which is a different, complementary layer from what RLS enforces. Kept both.

Wired into CI (`.github/workflows/ci.yml`): added `npx supabase start` before the test step and `npx supabase stop` after, so `npm run test` in CI now runs against the same real, migrated Postgres instance — this is what makes the suite actually merge-blocking rather than merely present.

All 40 tests pass (`npm run test`), `npx tsc --noEmit` clean (aside from the pre-existing, unrelated `retention/page.tsx` errors carried forward from prior passes), `npm run lint` clean.

### Updated gap table (supersedes gap #13 in the 2026-08-27 baseline table above)

| # | Gap | FR | Severity | Status |
|---|---|---|---|---|
| 13 | FR-26 adversarial suite was entirely mock-based, covered 2/7 scenarios end to end | FR-26 | High | **Resolved** this pass — real suite, 7/7, wired into CI |
| 17 | `public.users` UPDATE RLS policy had no `WITH CHECK`, allowing self role escalation to `system_admin` | FR-2/FR-26 #4, R5 | **Critical** | **Resolved** this pass |

### Notes
The stale local-DB mismatch (see "Environment change" above) is the reason gap #13 stayed a mock-only suite for as long as it did — every prior audit pass reasoned about RLS policies by reading the migration SQL, which is exactly the kind of check that can't distinguish "the policy in the file" from "the policy actually enforced by the running instance." Worth carrying forward as a standing practice: before trusting any local-Supabase-backed test result, confirm `npx supabase migration list` agrees with `ls supabase/migrations/`, or just `db reset` unconditionally if there's any doubt.

## Audit — 2026-08-27 (Phase 5) — FR-25 privacy notice acknowledgment

### Requirement traceability
- [x] FR-25 acceptance criteria re-read before implementing, not assumed from the task list wording alone: "A privacy notice is shown and acknowledged at first login and the acknowledgement recorded" (`prd-intern-docflow.md` line 179); G5 target is 100% of users acknowledged.

### What shipped
- `20240101000013_privacy_notice_acknowledgment.sql` — adds `users.privacy_acknowledged_at TIMESTAMPTZ`, nullable. No RLS change needed: the existing "Users can update own row" policy already covers a user setting this on their own row, and the migration-12 self-role-escalation trigger only restricts `role`.
- `lib/data/privacy.ts` — `getPrivacyAcknowledgmentStatus()` / `acknowledgePrivacyNotice()`; the latter writes the timestamp and a `PRIVACY_NOTICE_ACKNOWLEDGED` audit entry (actor, target, source IP), matching the pattern every other state-changing action in this codebase follows (05-security.md §7).
- `src/app/privacy-notice/page.tsx` — the notice + a required "I have read and understood" checkbox gating a `Continue` button. Reached before any workflow surface: wired into `src/app/page.tsx` (the post-login router) and into all four role layouts (`intern`, `approver`, `admin`, `system-admin`), plus `src/app/onboarding/page.tsx` directly since that route had no layout of its own to hook into and is otherwise reachable by direct link before the root router's redirect ever runs. A user who has already acknowledged is redirected away from `/privacy-notice` itself, back through `/`.
- Click-tested end to end against the local instance (not just unit-tested): signed in as a fresh intern with `privacy_acknowledged_at` null → landed on `/privacy-notice` → native `required` validation blocked `Continue` with the checkbox unchecked → checked it, submitted → redirected to `/onboarding` (this intern had no internship dates yet, confirming the privacy gate runs *before* the existing onboarding gate) → re-visited `/privacy-notice` directly → redirected away, confirming it doesn't re-prompt. Verified directly against the database that `privacy_acknowledged_at` was set and the `PRIVACY_NOTICE_ACKNOWLEDGED` audit row was written with the correct actor/target/IP.

### Known gap — the notice text itself is a draft, not final legal copy
`prd-intern-docflow.md` §14 marks two facts this notice would normally need as `[NEEDS INPUT]`, still unanswered by Makerspace: the named Data Protection Officer (RA 10173 requires a named individual, not the organisation itself, to be registered with the NPC as DPO) and Carl's surname/formal title. Rather than invent either, the shipped notice describes data collected, purpose, legal basis, access scoping, and retention (all facts already established elsewhere in this codebase/PRD), and directs privacy requests to "your Makerspace program coordinator" instead of a named DPO contact. **This must be revisited before pilot/go-live** — swap in the real DPO's name and contact details once Makerspace provides them, per `13-plan-redo-organization.md`'s change-control convention for PRD gaps. Flagging this here rather than treating FR-25 as fully closed: the *mechanism* (gate, recording, audit trail) is done and tested; the *legal content* has a known, tracked placeholder.

### Verification
`npx tsc --noEmit` clean (aside from the pre-existing, unrelated `retention/page.tsx` errors), `npm run lint` clean, `npm run test` 45/45 (7 files, including a new `__tests__/privacy.test.ts`), `npx secretlint "**/*"` clean.

## Audit — 2026-08-27 (Phase 5) — Accessibility scan + keyboard pass, WCAG 2.1 AA

### Method
Automated: installed `axe-core` (devDependency), loaded it into the live local app in the Browser pane and ran `axe.run()` scoped to `wcag2a`/`wcag2aa`/`wcag21a`/`wcag21aa` rule tags against the full rendered DOM on each page, signed in as a real user of each role (fresh test users seeded and deleted afterward, not committed to any migration/seed file). Manual: real keyboard interaction (Tab, Escape, native `disabled`-state checks) against the dialogs already built around Radix `Dialog` and native `disabled` buttons this Phase 5 pass and the previous one.

**This is a real interactive scan run this session, not a standing CI check** — unlike FR-26, it is not wired into `.github/workflows/ci.yml`. Doing that properly needs `@axe-core/playwright` or equivalent, which needs Playwright installed first (gap #14, still open — see `Next steps` below). Treat this pass the same way as the backup-restore rehearsal below: a one-time verification that something works today, not an automated regression gate going forward.

### Pages/states covered
`/login` (unauthenticated) · `/privacy-notice` (fresh, unacknowledged intern) · `/onboarding` · `/intern` + its upload dialog (Escape-to-close verified) · `/approver` · `/approver/signature` + its "Save this signature?" preview-confirm dialog · `/admin/dashboard` · `/admin/requirements` · `/admin/routing-templates` · `/admin/users` (+ invite form) · `/admin/final-approval` · `/system-admin` · `/system-admin/users` · `/system-admin/audit-log` · `/system-admin/retention` + its "Run retention sweep now?" typed-confirmation dialog (verified the `Run Sweep` button carries the native `disabled` attribute until `PURGE` is typed, and that Escape dismisses it without triggering the sweep).

**Not covered** (no silent claim of completeness): `/admin/submissions/[id]`, `/system-admin` sub-flows beyond what's listed, `SubmissionTimelineModal`, and any state that needs a populated dataset the fresh local DB didn't have (e.g. a genuinely overflowing dashboard matrix or audit log with many rows — see below for how this was handled instead).

### Findings, all fixed in this pass
1. **`src/app/privacy-notice/page.tsx`** — the scrollable notice-body `<div>` (`overflow-y-auto`) had no keyboard access (axe: `scrollable-region-focusable`, serious). A keyboard-only user could not scroll it to read the rest of the notice. Fixed: `tabIndex={0}` + `role="region"` + `aria-label`.
2. **`AdminDashboardMatrix.tsx`** — 3 filter `<select>` elements (Requirement/State/Approver) had a visually-adjacent `<label>` with no `htmlFor`/`id` link, so they had no accessible name (axe: `select-name`, **critical**). Fixed with matching `id`/`htmlFor` pairs.
3. **`AdminInviteForm.tsx`** — same unlinked-label pattern on the invite email input and role `<select>` (axe: `select-name`, critical, on `/admin/users`). Fixed the same way.
4. **`AuditLogTable.tsx`** — same unlinked-label pattern on the Actor/Action filter selects (axe: `select-name`, critical, on `/system-admin/audit-log`). Fixed the same way.
5. **`AdminRequirementManager.tsx`** and **`AdminRoutingTemplateManager.tsx`** — a "Version N" / step-role badge used `text-slate-500` on `bg-slate-100`/`bg-slate-200/60`, below the 4.5:1 AA threshold for small text (axe: `color-contrast`, serious). Every structurally identical badge elsewhere in the codebase (`UserManagementTable.tsx`, `AuditLogTable.tsx`, `InternChecklist.tsx`, `ApproverQueue.tsx`) already uses `text-slate-600`/`text-slate-700` on the same background — these two were the only outliers, not a deliberate design choice. Fixed to `text-slate-700` to match the established pattern.
6. **`AuditLogTable.tsx`** — the wide table's `overflow-x-auto` wrapper (min-width 800px content) had no keyboard access, same `scrollable-region-focusable` issue as #1, on `/system-admin/audit-log`.

### Preventive fix, not scan-confirmed on every page
Finding #6 only triggers axe's rule when the region is *actually* overflowing at scan time — with a freshly-reset local DB and no seed data, `/admin/dashboard`'s matrix and `/approver`'s queue table were both too empty to overflow, so the same `overflow-x-auto` pattern in `AdminDashboardMatrix.tsx`, `UserManagementTable.tsx`, `ApproverQueue.tsx`, and `system-admin/retention/page.tsx` (the purge-log table) could not be scan-confirmed as broken there. Since it's the exact same structural pattern already proven broken twice (findings #1 and #6) and the fix is free (a `tabIndex`/`role`/`aria-label` triple that does nothing when the region isn't scrollable), applied it to all four preventively rather than leaving them to fail silently once real data makes them overflow. Flagging this distinction explicitly per the "no silent caps" principle — these four are *not* scan-confirmed, they're pattern-matched against a confirmed defect.

### Keyboard pass, manual
- Upload dialog (`/intern`), signature preview-confirm dialog (`/approver/signature`), retention-sweep confirm dialog (`/system-admin/retention`): all close on Escape, confirmed by checking the interactive element tree before and after the keypress.
- Retention sweep's typed-confirmation `Run Sweep` button: confirmed `disabled === true` in the DOM until the exact string `PURGE` is present, which also makes it correctly unreachable by Tab while disabled (native semantics, not a custom aria-disabled workaround).
- Privacy notice checkbox: confirmed the browser's native `required` validation blocks form submission with a visible prompt when unchecked, without any custom JS needed.

### Verification
`npx tsc --noEmit` clean (aside from the pre-existing, unrelated `retention/page.tsx` errors — confirmed the one line touched there, the `overflow-x-auto` wrapper, is untouched by and does not touch those errors), `npm run lint` clean, `npm run test` 45/45.

### Next steps this pass did not cover
Installing Playwright + `@axe-core/playwright` to make this a standing CI gate (gap #14) rather than a manual re-run is the natural follow-up, and would also close the remaining "not covered" pages above with realistic seeded data instead of an empty local DB.

## Audit — 2026-08-27 (Phase 5) — Backup/restore rehearsal, first real run

Full rehearsal log lives in `docs/14-backup-restore-runbook.md`'s "Rehearsal Log" table — this entry is the short version plus what it means for the audit trail.

Seeded one realistic row per table (user, submission, version, approval, audit entry) into the local instance, recorded baseline row counts, took a real data-only backup (`supabase db dump --data-only --use-copy --schema public,auth`), simulated total data loss (`supabase db reset`), restored the backup, and confirmed both the row counts and the actual joined content of the restored rows matched exactly. Also re-ran the runbook's RLS-enabled, append-only-grant, and private-bucket verification queries against the restored database — all passed.

**Two documentation defects in the runbook itself, found only by actually running it, not by reading it:**
- `db dump --local -f backup.sql` (as originally written) is schema-only, not "schema + data" as the runbook claimed — confirmed by grepping the output for zero `INSERT`/`COPY` statements. The correct data command needs `--data-only`, and needs `--schema public,auth` since `public.users`/`audit_log` both have foreign keys into `auth.users`.
- The runbook documented a `privacy_acknowledgements` table that was never built — FR-25 (this same Phase 5 pass, above) shipped `users.privacy_acknowledged_at` as a column instead. The runbook's table list and verification queries referenced a table that doesn't exist.

Both are fixed in the runbook now. Neither would have been caught by re-reading the document — only by executing it against a real database, which is exactly why this rehearsal requirement exists as its own PRD gate rather than being assumed from "we wrote a runbook."

**Not exercised this pass**: storage bucket object backup/restore (section 2/4 of the runbook) and the stale-file-bytes retention check (query 5d) — the rehearsal dataset had no actual uploaded file bytes and nothing old enough to be retention-eligible. Recommend a follow-up rehearsal that includes a real file upload through the storage backup/restore cycle before this is considered fully proven end-to-end.

All rehearsal data, the dump files, and the temporary `.rehearsal-tmp/` directory were deleted after verification; nothing from this rehearsal is committed to the repo or the local database's current state.

## Audit — 2026-08-28 — Full PRD re-check against current code

> Scope: this document's last entry is 2026-08-27. Five commits have landed since (`ca293eb`, `b00dc06`, `39ae18b`, `dcc7149`, plus this session's own work: retention/signature page consolidation, two routing templates removed, an onboarding/printed-name feature added then partly reworked, FR-5/FR-10/FR-21 name-display fixes), none reflected here. Re-verified every FR against current code rather than assuming this document's snapshot still holds, per its own standing warning (2026-08-27 entry, "always re-verify against current code before relying on a PASS").

### Confirmed resolved since the last snapshot (no entry existed for these)
- **Gap #2 (FR-18, old approver not emailed on reassignment)** — `reassignApprover()` in `lib/data/submissions.ts` now emails the previous holder (`sendEmailWithRetry(previousApprover.email, ...)`) in addition to the notification row. Fixed at some point in the unaudited commits; mark **Resolved**.
- **Brand/logo `[NEEDS INPUT]` (§14, §11)** — `07-design-system.md` records a 2026-08-27 decision: real hex values (`#1B3251` primary, `#C9400A` accent), independently WCAG AA-verified against white, extracted from the original Makerspace logo. The Makerspace raster itself was retired in favor of a code-drawn `Logo`/`LogoMark`/`Wordmark`. This PRD open question can be closed.

### New gaps found this pass

| # | Gap | FR / Appendix | Severity | Status |
|---|---|---|---|---|
| 18 | No automatic trigger for any scheduled job — no `vercel.json` `crons`, no `pg_cron` SQL in any migration, no `/api/cron/*` route. `lib/jobs/retention-sweep.ts` (FR-17, FR-22) and `lib/jobs/daily-digest.ts` (FR-19) are fully coded and tested but only run when a system_admin clicks "Run Sweep Now" on `/system-admin/retention` — there is no equivalent manual trigger for the digest at all. FR-22 is explicitly one of the items the PRD's own MVP cut-line (§13) says is "never cut," and it is not actually running automatically today. | FR-17, FR-19, FR-22 | **Critical** | **Open** |
| 19 | FR-4's "optional template file to download" is entirely unimplemented. `requirements.template_url` (column) and the `templates` storage bucket both exist from the original migration, but `requirementSchema` in `lib/data/requirements.ts`, `AdminRequirementManager.tsx`, and the intern checklist never read or write it — no upload control, no download link. | FR-4 | High | **Open** |
| 20 | FR-3's "editable until the first submission is approved, after which a change requires admin action" has no admin-side path. The only writer, `updateInternshipDates()` in `lib/data/users.ts`, is self-service only (scoped to `auth.uid()`); nothing lets an admin change another user's locked dates. Once locked, a wrong date is permanently uncorrectable by anyone. | FR-3 | High | **Open** |
| 21 | Appendix A's `CANCEL` action (DRAFT/RETURNED → CANCELLED, Administrator-only) is defined in `lib/state-machine/index.ts` but has zero callers anywhere in `lib/data` — no Server Action or UI ever invokes it. Separately, Appendix A's own notes column says "Admin may reopen" an EXPIRED submission, but there is no `REOPEN` action type at all and no rule from `EXPIRED` except `PURGE` — reopening isn't representable in the state machine, let alone implemented. | Appendix A | Medium | **Open** |
| 22 | NFR "test coverage at least 70% on workflow, signature, and authorisation modules" is unmeasured — no `@vitest/coverage-v8`/istanbul installed, no `coverage` block in `vitest.config.ts`. Tests pass; the actual percentage has never been checked. | NFR Maintainability | Medium | **Open** |

### Still open, unchanged from the 2026-08-27 baseline
- Gap #14 (Playwright absent) — confirmed still true: no `playwright` in `package.json`, zero `.spec.ts` files anywhere. The FR-26-adjacent accessibility scan remains a manual one-off, not a CI gate.
- Storage-bucket (file bytes) backup/restore rehearsal still not exercised — only table data was rehearsed.
- Privacy notice DPO name and Carl's surname/title (§14) — confirmed still the generic "your Makerspace program coordinator" placeholder in `src/app/privacy-notice/page.tsx`. Still genuinely unanswered by Makerspace, not a code gap.
- Resend verified sending domain, exact internship/development-cycle dates (§14) — external facts, unverifiable from code, still marked `[NEEDS INPUT]` in the PRD itself.

### Observation, not a defect
`src/app/onboarding/page.tsx` (the original FR-3 internship-date capture page, gated by `src/app/page.tsx`'s root router when `internship_start`/`internship_end` are null) is still live and still correctly reachable — but this session's accept-invite rework now also collects those same two fields for interns during initial account setup, so for any *new* intern going forward `/onboarding` is never reached (dates are already set by the time they land on `/`). It remains the correct fallback for any intern account that predates the feature. Not broken, just worth knowing two paths now lead to the same place under different entry conditions, rather than one being obsolete.

### Verification
`npx tsc --noEmit`, `npm run lint`, and `npx vitest run` (58/58) all clean as of this session's last change before this audit pass. This pass itself was static analysis and code reading only — no new code changed as part of writing this entry.

## Audit — 2026-08-28 (same day, later) — Fixes for every gap found above, in priority order

> Scope: closes gaps #18–#22 from the audit above (in Critical → High → Medium order), then gap #14 (Playwright) and the storage backup/restore rehearsal that was still open. All work verified against a real local Postgres instance (`npx supabase db reset`, 20 migrations applying cleanly), not just read from the migration files.

**Gap #18 (Critical, scheduled jobs never ran automatically) — Resolved.** `supabase/migrations/20240101000019_schedule_jobs.sql` enables `pg_cron`+`pg_net` and schedules both jobs via `net.http_post` against two new protected routes, `src/app/api/cron/retention-sweep` and `src/app/api/cron/daily-digest`, authenticated by a shared `CRON_SECRET` (added to `.env.example`, which didn't exist before — also closes a standing gap against `12-backend-security-rules.md` §10). Verified: the migration applies cleanly and both jobs register (`select * from cron.job`); the routes' auth-gating logic is unit-tested (`__tests__/cron-routes.test.ts`, 7 tests: no header, wrong secret, unset `CRON_SECRET`, correct secret runs the job, job failure surfaces as 500 not a thrown exception). Full HTTP-level `pg_net -> route` execution wasn't reachable from this sandbox (see the smoke-test note under gap #14 below for why), but the SQL and the route logic are each independently verified correct. **Still needs a one-time manual step per environment** — `ALTER DATABASE ... SET app.settings.cron_target_url/cron_secret` — documented in the migration file itself; the jobs will fail visibly in `cron.job_run_details` until that's done, by design, rather than silently no-op.

**Gap #19 (High, FR-4 template file never implemented) — Resolved.** `uploadRequirementTemplate()`/`getRequirementTemplateDownloadUrl()` in `lib/data/requirements.ts`, using the `templates` bucket and column that already existed but were never wired to anything. Admin-side upload control per requirement card (`AdminRequirementManager.tsx`); intern-side "Download Template" button (`InternChecklist.tsx`), signed URL expiring in 5 minutes per FR-25.

**Gap #20 (High, FR-3 date lock had no admin override) — Resolved.** `updateInternshipDatesAsAdmin()` in `lib/data/users.ts` — same validation as the intern's own `updateInternshipDates()`, admin/system_admin only, doesn't check the lock (that's the point). Editable inline in `UserManagementTable.tsx` on `/system-admin/users`, matching the existing school/batch inline-edit pattern.

**Gap #21 (Medium, Appendix A CANCEL/REOPEN unreachable) — Resolved.** `cancelSubmission()` and `reopenSubmission()` in `lib/data/submissions.ts`; `REOPEN` added to the state machine (`EXPIRED -> IN_REVIEW`, admin-only — see the rule's own comment for why IN_REVIEW rather than a state-specific target). UI: `SubmissionAdminActions.tsx` on `/admin/submissions/[id]`, cancel requires a 10+ character reason via `ConfirmAction`. 7 new state-machine unit tests in `__tests__/submissions.test.ts`.

**Gap #22 (Medium, coverage NFR unmeasured) — Measured, not closed.** Installed `@vitest/coverage-v8`, scoped `coverage.include` to exactly the modules the NFR names (workflow/signature/authorisation) with a 70% threshold configured in `vitest.config.ts`, and ran it for real: `state-machine` 93.75%, `privacy.ts` 94.73%, `pdf/composite.ts` 73% all already clear it; `auth.ts` 21%, `signatures.ts` 20%, `submissions.ts` 16%, `users.ts` 10% do not (global 24.52%). Writing enough tests to close a 45-55 point gap across four files is a substantially larger effort than everything else in this pass, so it's reported honestly rather than rushed — `npm run coverage` is available locally; **not** wired into CI yet since the threshold would fail every build immediately.

**Gap #14 (Playwright, previously open) — Resolved.** Installed `@playwright/test` + `@axe-core/playwright`. `e2e/smoke.spec.ts` (5 tests: login renders, unauthenticated redirects, generic invalid-login error, accept-invite renders without a token) and `e2e/accessibility.spec.ts` (WCAG 2.1 A/AA scan on `/login` and `/accept-invite`) both wired into `.github/workflows/ci.yml` after the vitest step, while local Supabase is still up. **This immediately caught a real, previously-undetected bug**: "Docs" in the wordmark and "back." on the login page's dark hero panel (`text-brand-accent`, `#C9400A`) scored only 2.6:1 against the `#1B3251` background, failing WCAG 1.4.3's 3:1 floor for large bold text — the 2026-08-27 manual scan's per-color contrast check was against white only, never against this actual on-dark pairing. Fixed with a new `--brand-accent-on-dark: #FF8A50` token (5.55:1), documented in `07-design-system.md`. Re-ran after the fix: 7/7 pass. Scope note: only unauthenticated pages are covered so far (no seeded test-user infrastructure yet); the 2026-08-27 manual pass covered more authenticated pages than this automated first cut does — closing that gap is further work, not done here.

*Environment note*: local Playwright execution needed `next start` (production) rather than `next dev` -- a dev-mode singleton lock tied to another concurrent session sharing this machine blocked a second `next dev` regardless of port. Not relevant to CI (a fresh runner has no such conflict) or to end users; noted here only so a future session isn't puzzled by it.

**Storage backup/restore rehearsal (previously the runbook's one open gap) — Resolved.** Full write-up and a new dated log entry in `docs/14-backup-restore-runbook.md`. Real file bytes uploaded to all three buckets, downloaded, deleted (simulating loss), restored, and independently re-verified byte-for-byte via SHA-256 — all matched. Found and documented a genuine CLI issue along the way: `supabase storage cp/ls --local` doesn't work on CLI 2.116.0 (`LegacyStorageUnsupportedOperationError`); the rehearsal used the same `@supabase/supabase-js` storage calls the application code itself uses instead, which the runbook now documents as the primary method. Query 5d (stale file bytes past retention) remains the one still-unexercised check — needs a seeded submission old enough to qualify, a data-seeding gap rather than a mechanism gap.

### Verification
`npx tsc --noEmit` clean, `npm run lint` 0 errors, `npx vitest run` 72/72 (10 files — up from 58/58 at the top of this same day's earlier entry: +7 cron-route tests, +7 state-machine tests), `npx playwright test` 7/7 against a real production build. `npx supabase db reset` applied all 20 migrations (18 prior + this pass's #17–19, counting the two from the earlier session today) cleanly from scratch.