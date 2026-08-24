# InternDocs — Task Backlog

Source of truth: `prd-intern-docflow.md`. Every task below traces to a Functional Requirement (FR), Non-Functional Requirement (NFR), or an Appendix. Do not build anything that does not trace back to this PRD. If a task seems missing coverage, stop and flag it instead of inventing scope.

Stack lock: Next.js 16 (App Router), React, TypeScript, Supabase (Postgres, Auth, Storage), pdf-lib, Tailwind + shadcn/ui, Zod, Resend, Vitest, Playwright, Vercel.

Status legend: `[ ]` not started, `[~]` in progress, `[x]` done, `[!]` blocked.

---

## Phase 0 — Foundation (Week 1)

- [x] Initialize Next.js 16 repo, TypeScript strict mode, ESLint, Prettier
- [x] Set up Supabase project (dev), link CLI, configure migrations folder
- [x] Write initial schema migration: `users`, `roles`, `requirements`, `routing_templates`, `submissions`, `submission_versions`, `approvals`, `audit_log`, `notifications`
- [x] Enable RLS on every table at creation time, deny-by-default policies (no table ships without a policy — see `12-backend-security-rules.md`)
- [x] Create server-only data-access layer (`lib/data/*`, `import 'server-only'`) before any UI touches the database
- [x] Configure CI: lint, typecheck, unit tests, pre-commit secret scan, block merge on failure
- [ ] Set up staging environment on Vercel + Supabase
- [x] Encode the state machine from Appendix A as a typed, server-side state table (single source of truth, no ad-hoc status strings — Risk R6)
- [x] Write `.env.example`; confirm no secrets are committed
- [x] Apply placeholder brand tokens from `07-design-system.md` (swap when logo arrives)

## Phase 1 — Identity & Access (Week 2, FR-1, FR-2, FR-3)

- [x] Supabase Auth via `@supabase/ssr`, invitation-only, self-registration disabled
- [x] Invitation flow: admin invites email + role, 7-day expiry, 12-char minimum password on acceptance
- [x] Role assignment: exactly one role per user at signup, role change writes to `audit_log`
- [x] RLS policies for `users`, scoped so an intern cannot read another intern's row
- [x] Internship date entry (self-entry at first login), editable until first approval, then admin-only, end date > start date and within 12 months, changes audit-logged
- [x] Adversarial test: intern requests another intern's submission id directly via API → 403/404, never data (first entries in FR-26 suite)
- [x] Session idle timeout at 60 minutes (NFR security)

## Phase 2 — Requirements & Submission, Unsigned (Weeks 3–4, FR-4 to FR-8, FR-13)

- [x] Admin CRUD for requirement definitions: name, description, accepted types, max size, due date (fixed or relative), optional template file, routing template
- [x] Seed requirement types: Evaluation Paper, Daily Time Record
- [x] Publish requirement → visible to every intern within 5 seconds; editing does not alter already-approved submissions (version the requirement definition)
- [x] Intern checklist page (landing page after login): every requirement in one of the 8 defined states, due date, days remaining
- [x] Upload flow: PDF/PNG/JPEG, 20 MB max, magic-byte validation (not extension), specific rejection reasons
- [x] On successful upload: submission → `SUBMITTED`, version 1 sealed with SHA-256, approver notified, no public URLs ever issued
- [x] Re-upload after return: creates version n+1, marks n superseded, never overwrites, returns to step 1, prior versions and comments stay visible to submitter and admins
- [x] Routing template CRUD: 1–2 sequential steps, role or named user, optional SLA in working days, editable without deploy, editing creates a new revision, in-flight submissions keep their starting revision
- [x] Server-side transition guard: every transition validated against Appendix A; illegal transition → 409 + audit entry; no direct client write can change state
- [x] End-to-end manual check: a real DTR moves from upload to unsigned approval on staging

## Phase 3 — Signature (Week 5, FR-9, FR-11, FR-14)

- [x] Signature enrollment: canvas draw or PNG upload (transparent, <2 MB), stored in a bucket with no client-readable policy
- [x] Block first approval until a signature is enrolled; prompt at that point
- [x] Server-side compositing with pdf-lib: signature image + printed name + approval date placed at the requirement's configured position; signature image never sent to the browser during this operation
- [x] Signed output stored as new immutable artefact; original submitted version stays unmodified
- [x] Approval writes: approver id, UTC timestamp, step number, version approved, SHA-256 of that version
- [x] Guard rails: cannot approve a step not assigned to you, cannot approve the same step twice, explicit confirmation required
- [x] Freeze rule: after final approval, no role but the retention job can replace or delete either artefact
- [x] Download recomputes SHA-256 and warns on mismatch
- [x] Approver reassignment (FR-15): available on any in-review submission, reason required, both approvers notified, original loses access immediately, new approver's own signature applies

## Phase 4 — Retention, Notifications, Admin (Week 6, FR-16 to FR-24)

- [x] Submission timeline view: every event with actor, role, local timestamp, read-only, shows current holder and step X of N
- [x] Deletion countdown on checklist once fewer than 14 days remain
- [x] Resend integration for all FR-18 events: submission received, returned, approved, step assigned/reassigned, deletion warnings — no document content or attachment in any email, retry up to 3 times on failure
- [x] Daily reminder digest job: items past their SLA target (default 2 working days) to the approver; anything past 5 working days copies the admin; max 1 reminder per item per day
- [x] Admin completion dashboard: intern × requirement matrix, filterable by requirement/state/approver, renders under 3s at 100×10
- [x] CSV export of filtered view, under 60s, audit-logged with requesting actor
- [x] Retention job (daily): delete file bytes 30 days after approval, or 30 days after internship end for never-approved items; keep submission/approval/hash/comments/audit rows; must not run before the FR-17 warnings have been sent; each deletion audit-logged with hash and timestamp
- [x] Post-deletion approval record view for admins: intern, requirement, approver, timestamp, step, version, hash, deletion timestamp, clearly labelled as document-deleted
- [x] Append-only audit log: no application role can update or delete a row (enforce with grants, not just application logic), queryable by actor and by target

## Phase 5 — Hardening & Pilot (Week 7, FR-25, FR-26, NFRs)

- [ ] Signed URLs for every download, expiring within 5 minutes, generated only after a server-side permission check
- [ ] Privacy notice shown and acknowledged at first login, acknowledgement recorded
- [ ] Full FR-26 adversarial suite green in CI, blocking merge:
  - intern reads another intern's submission
  - approver acts on an unassigned step
  - approver acts after reassignment
  - intern calls an admin endpoint
  - edit attempt on an approved submission
  - direct storage access without a signed URL
  - client-side fetch of a stored signature image
- [ ] Automated accessibility scan + manual keyboard pass, WCAG 2.1 AA
- [ ] Backup restore rehearsed at least once
- [ ] Pilot: 3–5 real DTRs through the full flow with the actual approver signing

## Phase 6 — Handover (Week 8)

- [ ] Runbook (deploy, rollback, rotate secrets, run a manual retention pass)
- [ ] Admin guide (invite users, define requirements, build routing templates, reassign, export)
- [ ] Architecture doc (see `02-dev-guide.md` for structure)
- [ ] Demo to Makerspace
- [ ] QA gate sign-offs recorded (`10-quality-report.md`)
- [ ] Maintainer briefing

---

## Should-have backlog (pull forward only if Week 6 is not at risk)

- [ ] Admin-editable routing templates confirmed live without deploy (already required in Phase 2 — this item tracks polish only)
- [ ] Approver reassignment UI polish beyond the functional minimum
- [ ] Deadline reminder digest tuning (custom thresholds per requirement)
- [ ] CSV export column customization
- [ ] Inline PDF preview in the approver queue
- [ ] Bulk export of one intern's approved documents before deletion

## Cut line if Week 6 is at risk

Drop first, in order: reminder digest, CSV export, reassignment UI polish. Never drop: RLS, the audit log, the retention job with its warnings, the FR-26 adversarial suite.

## Won't build this cycle

Certificate-authority e-signatures, native mobile apps, payroll/HRIS integration, automated content validation, multi-tenancy, offline mode, historical document migration, parallel approval steps, OCR, in-app notification centre, intern countersignature, bulk cohort download.
