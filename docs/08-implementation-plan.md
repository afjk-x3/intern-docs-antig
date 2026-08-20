# InternDocs — Implementation Plan

Expands the PRD's 8-week timeline (§13) with technical sequencing. Pair with `01-tasks.md` for the checklist form of the same plan. If any week slips, apply the cut line in section 8, do not silently drop scope elsewhere.

## Sequencing logic

Build in this order because each layer depends on the one before it:

1. Schema and RLS before any UI, because RLS is a database concept and retrofitting it after the app assumes open access is how Risk R5 happens
2. The state machine before workflow UI, because Risk R6 is exactly "UI built against an ad-hoc status field instead of the real machine"
3. Unsigned approval before signature compositing, because it de-risks the harder part (Risk R7) by proving the workflow shape first
4. Retention and audit before the pilot, because the pilot needs a real, provable record from day one, not bolted on after

## Week 1 — Foundation

- Repo, CI, staging live
- Schema drafted and migrated: users, roles, requirements, routing_templates, submissions, submission_versions, approvals, audit_log, notifications
- RLS deny-by-default on every table as it is created
- State machine encoded as typed transitions (Appendix A), not string comparisons
- Data inventory and privacy notice drafted (feeds `05-security.md` section 4)
- Placeholder brand tokens applied (`07-design-system.md`)

**Exit criteria:** PRD signed off, state machine and API contract agreed in writing, schema drafted, repository/CI/staging live.

## Week 2 — Identity & access

- Invitation, login, role assignment, internship-date entry
- RLS policies for users and their own data
- First entries in the FR-26 adversarial suite passing

**Exit criteria:** invitation through login through role-scoped access works end to end; first adversarial tests green.

## Weeks 3–4 — Submission and approval, unsigned

- Requirement definitions, routing templates
- Upload with versioning
- Single approver step, approve (no signature yet) and return
- Status timeline
- A real DTR goes end to end on staging, unsigned

**Exit criteria:** a document can be created, submitted, routed, approved or returned, and its full timeline is visible, without signature compositing.

## Week 5 — Signature

- Signature enrollment (canvas + PNG fallback)
- Server-side compositing with pdf-lib
- Immutability rules after final approval
- Intern download with hash verification

**Exit criteria:** an approver with an enrolled signature can approve a document and the intern receives a signed PDF whose hash matches what was recorded at approval time.

## Week 6 — Retention, notifications, admin

- Resend wired to all FR-18 events
- Deletion warnings at 7 and 1 day
- Retention sweep job
- Reminder digest job
- Completion dashboard and CSV export

**Exit criteria:** every notification event fires correctly in staging, the retention job runs and respects the warning-before-delete order, the dashboard renders under the 3-second target.

## Week 7 — Hardening & pilot

- Full FR-26 suite green, blocking merge in CI
- Accessibility automated scan plus manual keyboard pass
- Backup restore rehearsed at least once
- Pilot: 3–5 real DTRs, real approver signing

**Exit criteria:** pilot completes with no unresolved authorization or data-integrity issue; accessibility scan passes; restore rehearsal documented.

## Week 8 — Handover

- Runbook, admin guide, architecture doc finalized
- Demo to Makerspace
- QA gate sign-offs recorded (`10-quality-report.md`)
- Named Makerspace maintainer briefed

**Exit criteria:** Makerspace maintainer confirms they can operate the system from the delivered documentation alone.

## Dependency notes worth remembering

- Signature compositing (Week 5) cannot start meaningfully until unsigned approval (Weeks 3–4) is stable — do not parallelize these, Risk R7 exists precisely because this looks parallelizable and isn't
- The retention job (Week 6) must not go live before the FR-17 warning emails are proven working, or Makerspace risks deleting a document nobody was warned about
- The FR-26 suite is not a Week 7 activity that starts from zero — individual scenarios are added as their corresponding feature ships in Weeks 2 through 6; Week 7 is where the full set is proven together and made merge-blocking

## Cut line (from PRD §13, repeated here so it is not missed)

If Week 6 is at risk: drop the reminder digest, CSV export, and reassignment polish to a post-cycle backlog first. Never cut: row-level security, the audit log, the retention job with its warnings, the adversarial test suite.
