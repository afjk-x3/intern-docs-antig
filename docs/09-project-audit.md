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

_(no audits yet — append here as phases complete)_

## What this document is not

Not the QA gate sign-off record (`10-quality-report.md`) and not the refactor history (`06-refactor-summary.md`). This document exists to catch drift from the PRD early and often, phase by phase, so nothing reaches Week 7 as a surprise.
