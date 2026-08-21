# InternDocs — Design Spec

## 0. Navigation Shell (applies to every surface below)

Every authenticated screen lives inside a persistent app shell, not a standalone page. The shell differs by role, since navigation needs differ by role.

**Admin — sidebar.** Admin has the most sections and will keep growing (Phase 4 adds the audit log and exports). A left sidebar, not a top nav, since a horizontal nav with 5+ items gets cramped. Sidebar sections, in order:
- Dashboard (completion matrix)
- Requirements
- Routing Templates
- Users (invitations, role management)
- Audit Log
- Retention & Deletions (Phase 4: post-deletion approval record view)

Sidebar shows the current admin's name and a sign-out action at the bottom. Active section is visually distinct (brand-colored indicator, not just bold text).

**Approver — sidebar**, same shell pattern as admin for consistency, fewer items:
- Queue
- Signature Settings

**Intern — top header, not a sidebar.** Intern has one real destination (the checklist), a sidebar would be mostly empty space. Header shows product name, the intern's name, days remaining in internship, and sign-out. No nav items needed beyond the logo linking back to the checklist.

All three shells share the same design tokens (`07-design-system.md`), just different structural chrome. Mobile: sidebar collapses to a hamburger-triggered drawer below 768px; the intern header stays as-is since it's already minimal.

---



Design principles from the PRD, apply everywhere:
- Status is legible at a glance
- Every state-changing action is confirmed before it fires
- Every return requires a reason, enforced in the UI as well as the server
- Nothing destructive happens in one click
- The deletion countdown is impossible to miss once it starts

---

## 1. Intern Checklist (FR-5)

The landing page after login. Answers one question: what do I still owe, where is it, and when does it disappear.

**Layout**
- Header: intern name, internship date range, days remaining in internship
- Privacy notice banner on first login only, must be acknowledged before the checklist is usable (FR-25)
- List of requirement cards, one per requirement, in due-date order

**Requirement card states** (8 total, must be visually distinct, not just labeled)
1. Not started — neutral, upload call to action
2. Draft — file attached, not yet submitted, edit/submit actions
3. Submitted — read-only, waiting for step assignment
4. In review — shows the approver's name and which step of how many
5. Returned — comment shown inline, re-upload call to action
6. Approved — download action, green confirmation state
7. Overdue — red/warning treatment, due date and days overdue
8. Deleted (retention) — grey, explains the file is gone but the approval record persists, link to the record view

**Deletion countdown**
- Appears once fewer than 14 days remain before deletion on an approved item
- Escalates visually at 7 days and 1 day, matching the FR-17 email warnings
- Never collapsible or dismissible

**Detail view (FR-16)**
- Chronological timeline: submission, approval, return, comment, reassignment, version change
- Each entry: actor, role, local timestamp (Asia/Manila display, UTC stored)
- Current holder and step X of N shown at the top, read-only

**Upload flow (FR-6, FR-7)**
- Drag-and-drop or file picker, accepted types and size limit stated before the user picks a file
- Specific rejection reason shown inline, not a generic error
- Re-upload after a return is a distinct action from first upload, and the prior version's comment stays visible alongside the new version

## 2. Approver Queue (FR-9, FR-10, FR-11, FR-12)

Fast list, inline preview, two primary actions.

**Layout**
- Queue list: submitter, requirement, waiting time, due date, sorted oldest first
- Overdue items visually distinguished (same red/warning treatment as the intern view for consistency)
- Queue count in the page header matches the number of actionable items exactly, no stale counts

**Item detail**
- Inline document preview (Should-have, not MVP-blocking; MVP can open the file in a new tab)
- Two primary actions: Approve, Return
- Approve requires explicit confirmation (a second step, not a second click on the same button) and applies the enrolled signature server-side
- Return requires a comment of at least 10 characters before the action is enabled, not just before submit

**Signature enrollment (FR-9)**
- Settings page reachable from the queue, not buried in a generic settings menu
- Canvas draw as primary method, PNG upload as the accessibility fallback for anyone who cannot draw with a pointer
- Signature preview shown only to the owner, never fetched by any other role
- Replace action available, replacement is audit-logged

**First-approval gate**
- An approver with no enrolled signature is blocked from approving and redirected to enrollment, with the reason stated plainly

## 3. Admin Console (FR-4, FR-8, FR-15, FR-20, FR-21)

Completion matrix with drill-down and the post-deletion record view.

**Dashboard**
- Matrix: interns (rows) × requirements (columns), each cell showing state
- Summary counts: complete, in review, returned, overdue
- Filters: requirement, state, approver
- Renders under 3 seconds at 100 interns × 10 requirements — if a filter change causes a visible stall, that is a defect, not a tuning nice-to-have

**Requirement and routing template management**
- Requirement form: name, description, accepted types, max size, due date (fixed or relative to internship dates), optional template file, routing template picker
- Routing template builder: 1–2 ordered steps, each a role or a named user, optional SLA in working days
- Editing a template in use is explicit about creating a new revision; the UI states that in-flight submissions keep their original revision

**Reassignment (FR-15)**
- Available from any in-review submission's detail view
- Reason field is required, not optional
- Confirmation step before the reassignment fires, since it revokes the original approver's access immediately

**Export (FR-21)**
- CSV export button on the filtered dashboard view
- Export reflects the current filter state exactly
- Confirmation that the export was audit-logged is not required in the UI, but the export must never silently fail

**Post-deletion approval record view (FR-23)**
- Reachable from the checklist's Deleted state and from the dashboard
- Fields: intern, requirement, approver, timestamp, step, version number, SHA-256 hash, deletion timestamp
- Clearly labelled that the document itself is gone and this is the surviving record

**User and invitation management (FR-1)**
- Invite form: email, role
- Pending invitations list with expiry countdown (7 days)
- Role change action, confirmed before it fires, audit-logged

**Audit log view (FR-24)**
- Queryable by actor and by target
- Read-only, no edit or delete action exists anywhere in the UI for this table

---

## Cross-cutting interaction notes

- Every approve, return, reassign, delete-adjacent, and role-change action gets a confirmation dialog stating plainly what will happen
- No action in this system is reversible by the user once fired except the intern's own draft-stage edits before first submit
- Error states always say what went wrong and what to do next, never a bare "something went wrong"