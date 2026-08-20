# InternDocs — Plan Redo & Organization

This document governs two things: what to do when the plan needs to change, and how the doc set itself stays organized as the project moves. Read this before reorganizing anything in `/docs`, reprioritizing `01-tasks.md`, or pulling a Should/Could item forward.

## 1. What triggers a replan

- A Should or Could item (PRD §6) is being pulled into the current phase ahead of a Must item
- A schedule slip large enough to threaten the Week 6 exit criteria in `08-implementation-plan.md`
- A scope addition not present anywhere in the PRD (new requirement type beyond evaluation papers and DTRs, a new role, a new integration)
- A architectural rule in `12-backend-security-rules.md` needs an exception
- Any of the four remaining [NEEDS INPUT] items in the PRD turns out to affect scope, not just a config value

A routine task reprioritization within the same phase, or a bug fix, is not a replan and does not need this process.

## 2. Replan process

1. State the trigger in one sentence: what changed, and what in this doc set it conflicts with.
2. Check `01-tasks.md` and `08-implementation-plan.md` for what the change actually displaces. Name it. A replan that adds scope without naming what it costs is scope creep (Risk R8), not a replan.
3. Apply the cut line first, if the trigger is schedule risk: drop reminder digest, then CSV export, then reassignment polish, before touching anything marked "never cut" (RLS, audit log, retention job, adversarial suite).
4. Update `01-tasks.md` and `08-implementation-plan.md` to reflect the new plan. Do not leave the old plan half-visible; delete or clearly mark superseded items.
5. If the change touches the state machine (Appendix A), the data model, or a security boundary, add an entry to `06-refactor-summary.md` in the same PR.
6. If the change is client-facing scope (not just internal sequencing), it needs a change-control note per PRD §15 — baseline changes go through the client approver, not through this repo alone.

## 3. Handling the PRD's remaining [NEEDS INPUT] items

The Makerspace logo has been delivered and is included in the project files; extracting its colors into `07-design-system.md` section 1 is a design-token update only, not a replan trigger. The other open items in PRD §14 (Carl's surname/title, DPO name, exact internship dates, Resend sending domain) are configuration or documentation values, not scope. When they arrive:

- Carl's surname/title → sign-off log and privacy notice text, no code change
- DPO name → privacy notice text and the breach-response procedure, no code change
- Internship dates → confirms the calendar the plan is already built against, no code change unless the 8-week window itself moves
- Resend domain → `.env` value, no code change

None of these block implementation. Do not wait on them to start Week 1.

## 4. Doc set organization rules

- The 13 documents in `/docs` are numbered in build order (foundation and rules first, reporting documents last). Keep new documents numbered consistently if the set grows; do not insert an unnumbered file.
- `01-tasks.md` and `08-implementation-plan.md` are the two documents that change most often. Everything else changes rarely and only for the reasons in section 1.
- `06-refactor-summary.md`, `09-project-audit.md`, and `10-quality-report.md` are living logs. Append to them; never delete a past entry.
- If a document in this set contradicts the PRD, the PRD wins until a change-control note says otherwise. These documents implement the PRD; they do not supersede it.
- If a document in this set contradicts another document in this set, flag it and resolve it explicitly rather than picking one silently — inconsistent guidance is worse than a gap.

## 5. What "redo" means here

Nothing in this project should ever be silently rebuilt from scratch. "Redo" means: state the trigger, name the cost, update the two living plan documents, log the structural change if there is one. A redo without a paper trail is exactly how Risk R8 (scope creep) and Risk R6 (ad-hoc status field instead of the real state machine) happen.
