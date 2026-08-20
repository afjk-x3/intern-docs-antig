# InternDocs — Makerspace Document Submission & Approval System

**Product Requirements Document**
Version 0.9 draft (pre-baseline) · Client: Makerspace · Client approver: Carl [NEEDS INPUT] surname, role
Date: 19 August 2026

> **Status.** All fourteen discovery questions have been answered by the client. Four items remain [NEEDS INPUT], listed in §14. Three client decisions carry consequences worth confirming explicitly before baseline: the 30-day retention rule (§9, R-3), the signature image (Appendix B, R-2), and the single-approver bottleneck (§12, R-1).

---

## 1. Overview & Objective

InternDocs is an internal web application for Makerspace that replaces email- and chat-based submission of intern requirements with a tracked, auditable workflow. An invited intern uploads a document — an evaluation paper or a Daily Time Record — against a defined requirement; the document is routed to the intern supervisor for review; the supervisor approves it, applying their signature, or returns it with comments; the intern sees the status at every step. Administrators get a live view of what is outstanding, what is overdue, and a permanent record of every approval.

**Objective:** every Makerspace intern requirement is submitted, signed, approved, and recorded in one system, with a complete and tamper-evident record of who approved what and when.

The build is also a training vehicle: two interns will develop it as a paired project, and Makerspace will own and maintain it afterwards, so documentation and handover are in scope rather than optional.

---

## 2. Background & Context

Intern requirements at Makerspace — principally evaluation papers and Daily Time Records (DTRs) requiring the supervisor's signature — are currently collected over email and messaging apps. Approvals arrive as replies or forwarded attachments. This produces four recurring failures: documents are lost in threads, the current version is ambiguous, nobody can say where a document is sitting without asking, and there is no reliable record of who signed what.

The record-keeping obligation is real. Evaluations and DTRs are personal data under the Philippine Data Privacy Act of 2012 (RA 10173), and DTRs are the evidence a school's OJT coordinator relies on to credit an intern's hours.

**Current tooling:** email and messaging apps. No historical migration is required (client decision, §10).

**Delivery envelope:** an internship cycle of approximately 8 weeks, two intern developers, part-time supervision. Exact dates: [NEEDS INPUT].

**Ownership:** Makerspace owns the Supabase and Vercel accounts and billing, and maintains the system after the internship ends.

---

## 3. Problem Statement

**Job to be done.** An intern must get a required document signed by their supervisor, before a deadline, and be able to prove it was done and keep a copy.

**The pain.**
- Interns cannot see whether a DTR has been signed or is still sitting unread.
- The supervisor has no queue, no priority order, and no reminder, so items stall.
- Administrators reconstruct completion status manually near the end of a cycle.
- Returned documents get re-sent as new attachments, so revision history is lost and the signed version is not always identifiable.
- There is no defensible record if an approval is later disputed by an intern's school.

**Current workarounds.** Manual spreadsheet trackers, follow-ups over chat, and shared drive folders named by convention.

---

## 4. Users & Personas

| Persona | Role / permissions | Volume | Goals |
|---|---|---|---|
| **Intern (Submitter)** | Uploads to own submissions only; reads and downloads own documents and history; sets own internship dates | 50–100 per cycle | Know what is required, submit it, get it signed on time, keep a copy |
| **Intern Supervisor (Approver)** | Reads and acts only on submissions routed to them; holds a stored signature image | 1–2 (Carl, plus 1 backup) | Clear the queue quickly, sign in one action, return work with a reason |
| **Administrator** | Full read across the cohort; defines requirements and routing; invites users; reassigns approvers; exports reports; views approval records after document deletion | 1–2 | See completion at a glance, unblock stalls, produce a compliance report |
| **System Administrator** | User and role management, retention and deletion, audit-log access | 1 | Keep access correct and data lawful |

Roles are assigned by invitation, never self-selected. One person may hold both Approver and Administrator roles; Carl is expected to.

---

## 5. Goals & Success Metrics

| ID | Goal | Success metric (KPI) |
|---|---|---|
| G1 | Cut the time from submission to signed approval | Median cycle time under 2 working days; 90th percentile under 5 working days |
| G2 | Give interns self-service visibility and a retrievable copy | Status-chasing messages drop by 80% vs. the previous cycle; 100% of submissions show a current state and holder; 100% of approved documents downloadable by the submitter before deletion |
| G3 | Produce a defensible, tamper-evident approval record | 100% of approvals carry approver identity, UTC timestamp, and the SHA-256 hash of the exact file approved; audit entries append-only; approval records survive document deletion |
| G4 | Give administrators live completion visibility | Cohort completion report generated in under 60 seconds with zero manual collation; overdue items visible without a query |
| G5 | Handle personal data lawfully and minimally | Zero documents readable by an unauthorised account, verified by an adversarial access test suite; 30-day retention enforced automatically; privacy notice acknowledged by 100% of users |
| G6 | Serve as a rigorous training project with a clean handover | Both interns pass code review on every merged PR; QA Gates 1–5 signed off; Makerspace can operate and modify the system from the delivered documentation |

---

## 6. Scope & MVP

**Must (MVP).** Invitation-only authentication with assigned roles; intern profile with self-entered internship dates; requirement definitions; document upload with versioning; approval routing of 1–2 sequential steps; approve-with-signature and return-with-comment; supervisor signature capture and stamping onto the approved PDF; status timeline visible to the submitter; approver queue; admin dashboard with overdue flags; intern download of approved documents; append-only audit log that outlives the documents; row-level access control; 30-day automated retention and deletion; email notifications via Resend.

**Should.** Admin-editable routing templates without a deploy; approver reassignment when Carl is unavailable; deadline reminder digest; CSV export of the completion report; inline PDF preview; bulk export of an intern's approved documents before deletion.

**Could.** Parallel approval steps; bulk download of a whole cohort; OCR text extraction for search; in-app notification centre; intern countersignature.

**Won't (this cycle).** Digitally certified e-signatures backed by a certificate authority under RA 8792; mobile native apps; payroll or HRIS integration; automated validation of document contents; multi-organisation tenancy; offline mode; migration of historical documents.

**MVP boundary.** One organisation (Makerspace), one cohort at a time, sequential routing of at most 2 steps, PDF and image uploads. The system is complete at MVP if an intern can submit a DTR, Carl can sign it, the intern can download the signed copy, and an admin can export who has completed what — with the approval record surviving the 30-day deletion.

**Explicitly out of scope.** Legal certification of signature validity; document generation or templating; storing government ID numbers as structured fields.

---

## 7. Functional Requirements

Each story carries acceptance criteria and the goal (G#) it serves.

### Access & identity

**FR-1 (G5)** — As an administrator I want to invite users into the Makerspace organisation and assign a role so that access is granted deliberately rather than by self-registration.
Acceptance criteria: Open self-registration is disabled; an uninvited email address cannot create an account. An invited user sets a password of at least 12 characters and lands in exactly one assigned role. Invitations expire after 7 days. Role changes are written to the audit log with actor and timestamp.

**FR-2 (G5)** — As a user I want the system to show me only what my role permits so that other interns' evaluations and DTRs are not exposed to me.
Acceptance criteria: An intern requesting another intern's submission id directly via the API receives 403 or 404, never the document or its metadata. An approver can read a submission only while it sits at a step assigned to them, or after they have acted on it. Enforcement is at the database layer via row-level security, not only in the UI; the adversarial test suite in FR-24 proves it.

**FR-3 (G2)** — As an intern I want to enter my own internship start and end dates so that my requirement deadlines are correct without an admin setting them.
Acceptance criteria: Dates are captured at first login and editable until the first submission is approved, after which a change requires admin action. The end date must be after the start date and within 12 months of it. Requirement due dates derive from these dates where a requirement is defined as relative (for example "DTR due 3 days after each period ends"). Changes are audit-logged.

### Requirements & submission

**FR-4 (G4)** — As an administrator I want to define the requirement set so that every intern is given the same checklist.
Acceptance criteria: A requirement has a name, description, accepted file types, a maximum file size, a due date (fixed or relative to internship dates), an optional template file to download, and a routing template. Publishing makes it visible to every intern within 5 seconds. Editing a requirement does not alter submissions already approved against its previous version. Evaluation papers and DTRs are seeded as the initial requirement types.

**FR-5 (G2)** — As an intern I want to see my checklist of required documents with their statuses so that I know what is outstanding without asking.
Acceptance criteria: The checklist shows every requirement in one of: Not started, Draft, Submitted, In review (with the approver's name), Returned, Approved, Overdue, Deleted (retention). Due date and days remaining are shown. It is the landing page after login.

**FR-6 (G1)** — As an intern I want to upload a file against a requirement so that it enters the approval workflow.
Acceptance criteria: Accepted types are PDF, PNG, and JPEG, up to 20 MB. The file type is validated by magic-byte inspection, not by extension. A rejected upload returns a specific reason. On success the submission moves to Submitted, version 1 is sealed with a SHA-256 hash, and the approver is notified. Files are stored in private buckets; no permanent public URL is ever issued.

**FR-7 (G3)** — As an intern I want re-uploading after a return to create a new version rather than overwrite so that the revision history stays intact.
Acceptance criteria: Re-upload creates version n+1 and marks version n superseded; no version is overwritten. Every version retains its own file, uploader, timestamp, and hash. The submission returns to step 1 of its chain. Prior versions and their return comments remain viewable by the submitter and by administrators.

### Approval, signature & workflow

**FR-8 (G1)** — As an administrator I want to define a routing template as an ordered list of 1 or 2 approvers so that each document type reaches the right signatory.
Acceptance criteria: A template holds 1 to 2 sequential steps, each naming a role or a specific user, with an optional service-level target in working days. Templates are editable without a code deploy. Editing a template in use creates a new revision; in-flight submissions keep the revision they started on.

**FR-9 (G3)** — As an approver I want to enrol a signature image once so that I do not have to draw it on every approval.
Acceptance criteria: The approver draws on a canvas or uploads a transparent PNG, under 2 MB. The image is stored in a private bucket readable by no client role and served to no browser except the owner's own settings page. It can be replaced, and replacement is audit-logged. An approver with no enrolled signature is prompted before their first approval and cannot approve without one.

**FR-10 (G3)** — As an approver I want a queue of only the items awaiting my action so that I can clear them without hunting.
Acceptance criteria: The queue shows submitter, requirement, waiting time, and due date, sorted oldest first, excluding anything not at my step. Overdue items are visually distinguished. The queue count matches the number of actionable items exactly.

**FR-11 (G1, G3)** — As an approver I want to approve an item and have my signature applied so that the intern receives a signed document.
Acceptance criteria: Approval records approver id, UTC timestamp, step number, the version approved, and that version's SHA-256 hash. The signature image is composited server-side onto the output PDF at the position configured for that requirement, together with the approver's printed name and the approval date. The signed output is stored as a new immutable artefact; the intern's original submitted version is retained unmodified. The signature image is never sent to the browser during this operation. An approver cannot approve a step not assigned to them, cannot approve the same step twice, and must confirm explicitly.

**FR-12 (G1)** — As an approver I want to return an item with a required comment so that the intern knows exactly what to fix.
Acceptance criteria: A return requires a comment of at least 10 characters. The submission moves to Returned, the submitter is notified with the comment, and the comment is permanently attached to the version returned. No signature is applied on a return.

**FR-13 (G3)** — As the system I want to reject any state transition that is not legal for the current state so that the workflow cannot be bypassed.
Acceptance criteria: Transitions are validated server-side against the state machine in Appendix A. An illegal transition (approving a Draft, editing an Approved submission) is rejected with 409 and written to the audit log as a denied attempt. A submission's state changes only through the workflow API, never by a direct client write.

**FR-14 (G3)** — As an administrator I want an approved document frozen so that the signed artefact cannot be altered after the fact.
Acceptance criteria: After final approval neither the submitted version nor the signed output can be replaced or deleted by any role except the retention job in FR-22. Downloading recomputes the SHA-256 and warns if it does not match the hash recorded at approval.

**FR-15 (G4)** — As an administrator I want to reassign a stalled step to a different approver so that one person's absence does not block the cohort.
Acceptance criteria: Reassignment is available on any in-review submission, requires a reason, notifies both approvers, and is audit-logged. The original approver loses access at the moment of reassignment. The new approver's own signature is applied on approval, never the original's.

### Visibility, retrieval & reporting

**FR-16 (G2)** — As an intern I want a chronological timeline for each submission so that I can see every event that has happened to it.
Acceptance criteria: The timeline lists every submission, approval, return, comment, reassignment, and version change, each with actor, role, and local timestamp. It is read-only and shows who currently holds the document and which step of how many.

**FR-17 (G2, G5)** — As an intern I want to download my signed documents before they are deleted so that I keep the copy my school requires.
Acceptance criteria: Every approved document is downloadable by its submitter from approval until deletion. The checklist shows a visible countdown of days remaining before deletion once fewer than 14 remain. A reminder email is sent 7 days and 1 day before deletion listing the documents affected. Every download is audit-logged.

**FR-18 (G1)** — As a user I want email notifications on events needing my attention so that I act without checking the app.
Acceptance criteria: Emails are sent via Resend on: submission received (to the approver), item returned (to the submitter), item approved (to the submitter), step assigned or reassigned (to both approvers), and the FR-17 deletion warnings. Each email links to the item and contains no document content and no attachment. Delivery failures are logged and retried up to 3 times.

**FR-19 (G1)** — As an approver I want a reminder when an item has waited past its target so that items do not stall silently.
Acceptance criteria: A scheduled job runs once every 24 hours and emails a digest of items exceeding their step target, defaulting to 2 working days. An administrator receives a copy of anything exceeding 5 working days. No item generates more than 1 reminder per day.

**FR-20 (G4)** — As an administrator I want a cohort completion dashboard so that I can see status without collating anything by hand.
Acceptance criteria: A matrix of interns against requirements shows each cell's state, with counts of complete, in review, returned, and overdue. Filterable by requirement, state, and approver. Renders in under 3 seconds for 100 interns and 10 requirements.

**FR-21 (G4)** — As an administrator I want to export the completion report so that I can file or circulate it.
Acceptance criteria: CSV export of the current filtered view, generated in under 60 seconds, containing intern name, requirement, state, submitted date, approved date, approver, and current holder. The export is audit-logged with the requesting actor.

### Retention, audit & assurance

**FR-22 (G5)** — As a data subject I want my documents deleted 30 days after approval so that my personal data is not held longer than necessary.
Acceptance criteria: A scheduled job runs daily and permanently deletes the stored files — submitted versions and signed outputs — 30 days after final approval, or 30 days after the internship end date for items never approved. Deletion removes the file bytes from storage. The submission record, approval record, hashes, comments, and audit entries are retained (FR-23). The FR-17 warnings must have been sent before any deletion. Each deletion is audit-logged with the file hash and the timestamp.

**FR-23 (G3, G5)** — As an administrator I want approval records to outlive the documents so that I can still prove a signature was given after the file is gone.
Acceptance criteria: After deletion an administrator can still view: intern, requirement, approver, approval timestamp, step, version number, the SHA-256 hash of the approved file, and the deletion timestamp. The record is clearly labelled as document-deleted. Approval records are retained for at least 3 years and cannot be edited or deleted by any application role.

**FR-24 (G3, G5)** — As an administrator I want an append-only audit log of every security- and workflow-relevant event so that actions can be reconstructed and disputes settled.
Acceptance criteria: Logged events include login, failed login, invitation, role change, internship-date change, upload, download, state transition, denied transition, permission denial, signature enrolment or replacement, reassignment, export, and deletion. Each entry holds actor, action, target, UTC timestamp, and source IP. No application role can update or delete an entry, enforced at the database layer. The log is queryable by target and by actor.

**FR-25 (G5)** — As a user I want file downloads authorised per request so that a leaked link cannot expose a document.
Acceptance criteria: Downloads use signed URLs expiring within 5 minutes, generated only after a server-side permission check, single-purpose and not guessable. A privacy notice is shown and acknowledged at first login and the acknowledgement recorded.

**FR-26 (G5, G6)** — As the development team I want an adversarial authorisation test suite so that access-control regressions are caught before release.
Acceptance criteria: Automated tests cover at minimum: an intern reading another intern's submission, an approver acting on an unassigned step, an approver acting after reassignment, an intern calling an admin endpoint, editing an approved submission, direct storage access without a signed URL, and any client-side fetch of a stored signature image. All 7 scenarios must fail closed. The suite runs in CI on every pull request and a failure blocks merge.

---

## 8. Non-Functional Requirements

| Area | Requirement | Goal |
|---|---|---|
| Performance | Page interactions respond in under 500 ms at the 95th percentile; dashboard under 3 s for 100 interns × 10 requirements; upload of a 20 MB file completes in under 30 s on a 10 Mbps connection; signature compositing completes in under 5 s | G1, G4 |
| Availability | 99.0% monthly uptime during the internship cycle; no scheduled downtime during working hours 08:00–18:00 PHT | G1 |
| Scale | 100 concurrent users; a cohort of up to 100 interns; 6,000 submissions and 12,000 file versions per cycle; storage sized for 100 GB before retention deletion | G4 |
| Security | TLS 1.2 or higher in transit; AES-256 encryption at rest; row-level security on 100% of tables holding user data; secrets in a managed store with 0 secrets in the repository or client bundle; passwords hashed with bcrypt or Argon2; session idle timeout 60 minutes; signature images readable by 0 client roles | G5 |
| Privacy / compliance | Compliant with RA 10173 and its IRR: documented lawful basis, privacy notice acknowledged by 100% of users, data minimisation, 30-day document retention enforced by an automated job, and a breach-response procedure with 72-hour notification | G5 |
| Auditability | 100% of the events in FR-24 logged; audit and approval records immutable; 0 successful update or delete operations on those tables from any application role; approval records retained at least 3 years | G3 |
| Accessibility | WCAG 2.1 Level AA; keyboard-operable for 100% of primary workflows; contrast ratio at least 4.5:1 for body text | G2 |
| Usability | A new intern completes a first submission unaided in under 5 minutes; approve-with-signature takes at most 3 clicks from the queue | G1, G2 |
| Browser support | Latest 2 versions of Chrome, Edge, Safari, and Firefox; usable at 360 px viewport width; signature canvas usable on a touch device | G2 |
| Localization | English only, single locale; timestamps stored in UTC and displayed in Asia/Manila (UTC+8) | — |
| Backup & recovery | Daily automated backup with 7-day retention; recovery point objective 24 hours; recovery time objective 4 hours; restore rehearsed at least 1 time before go-live | G3 |
| Maintainability | Test coverage at least 70% on workflow, signature, and authorisation modules; 100% of merges via reviewed pull request; 0 direct commits to main; a runbook and admin guide delivered at handover | G6 |

---

## 9. Data Requirements

| Entity | Source | Sensitivity / classification | Retention | Owner |
|---|---|---|---|---|
| User (name, work email, role, internship dates) | Admin invitation; intern self-entry | Personal | Cohort end + 1 year | Makerspace |
| Requirement definition | Admin | Internal | Indefinite | Makerspace |
| Routing template | Admin | Internal | Indefinite | Makerspace |
| Submission (state, timestamps, due date) | App | Personal | 3 years (metadata only after file deletion) | Makerspace |
| Document version — file bytes | Intern upload | Sensitive personal — evaluations and DTRs | 30 days after approval, then permanently deleted | Data subject / Makerspace |
| Signed output PDF | App (composited) | Sensitive personal — carries a signature image | 30 days after approval, then permanently deleted | Data subject / Makerspace |
| Approver signature image | Approver enrolment | Sensitive — forgeable if disclosed | Until replaced or the approver leaves; deleted on offboarding | Approver |
| Approval record (approver, timestamp, hash) | App | Personal, legally significant | At least 3 years; survives document deletion | Makerspace |
| Comment / return reason | Approver | Personal, evaluative | 3 years, with its submission | Makerspace |
| Audit log entry | App | Internal, security-relevant | At least 3 years | Makerspace |
| Notification record | App | Internal | 90 days | Makerspace |

**Data protection notes.**
1. No government ID documents are collected. The requirement set is evaluation papers and DTRs only. If an ID requirement is added later it is a change-control item, not a configuration change, because it raises the sensitivity classification.
2. The signature image is the most dangerous single asset in the system. It is stored privately, never served to any browser other than its owner's settings page, composited server-side only, and covered by its own adversarial test (FR-26). It is deleted when the approver is offboarded.
3. The 30-day retention rule deletes evidence the intern may still need. FR-17 exists to mitigate this: warnings at 7 days and 1 day, and download available throughout. Makerspace should confirm the 30-day clock starts at approval (assumed) and that no school or regulatory requirement obliges Makerspace to retain the DTRs longer. See risk R-3.

---

## 10. Technology Stack, Integrations & Dependencies

> **Note:** The table below lists Next.js 15 as originally specified by the client. This has since been changed to **Next.js 16** — build against Next.js 16 conventions and APIs throughout, not Next.js 15.

### Decided stack

| Layer | Choice | Why this and not the alternative |
|---|---|---|
| Frontend & server | Next.js 15 (App Router) + React + TypeScript *(superseded: use Next.js 16)* | Server Components keep authorisation on the server; one codebase for UI and API; typed end to end |
| Database | Supabase (PostgreSQL) | Row-level security enforces FR-2 in the database, not in application code; relational joins suit the users → submissions → versions → approvals → audit model; transactions make FR-11 atomic; grants make the audit and approval tables genuinely append-only |
| Auth | Supabase Auth via @supabase/ssr | Invitation-only onboarding, server-side session verification, and the same identity RLS policies read. No SSO this cycle (client decision) |
| File storage | Supabase Storage, private buckets | Short-lived signed URLs satisfy FR-25; signature images sit in a bucket with no client-readable policy at all |
| PDF signature compositing | pdf-lib (server-side) | Places the signature image, printed name, and date onto the approved PDF without shipping the image to the browser |
| Scheduled jobs | Supabase cron / pg_cron | Runs the FR-19 reminder digest, the FR-17 deletion warnings, and the FR-22 retention sweep |
| Styling | Tailwind CSS + shadcn/ui | Accessible primitives; fast route to the WCAG 2.1 AA target |
| Validation | Zod, shared client and server | Every input validated server-side regardless of the client |
| Email | Resend | Client decision. Verified sending domain required: [NEEDS INPUT] |
| Testing | Vitest (unit and authorisation) and Playwright (end-to-end) | FR-26 runs in CI and blocks merge |
| Hosting | Vercel (app) + Supabase (data), both owned by Makerspace | Makerspace holds the accounts and billing and retains them after the internship |

MongoDB was evaluated and rejected. It offers no database-layer authorisation equivalent to row-level security, so every access check would live in application code — an unacceptable risk profile for sensitive personal data built by developers who are learning. The workload is join-heavy rather than document-shaped, and the immutable audit and approval records depend on engine-enforced permissions.

### Architectural rules (binding)

1. RLS on every table, deny by default, from the first migration. A table without a policy does not pass code review.
2. All database and storage access flows through a server-only data-access layer marked `import 'server-only'`. No component queries the database directly.
3. The Supabase service-role key never reaches the client bundle, is never committed, and is never used to bypass a policy for convenience.
4. The signature image never leaves the server except to its owner's settings page.
5. Schema changes are tracked migration files applied to a dev project. No manual edits to production.
6. Secrets live in the platform's encrypted store or Supabase Vault. Only `.env.example` is committed; a pre-commit secret scan runs in CI.

### External dependencies

- **Authentication** — invitation-only email and password. No organisational SSO this cycle (client decision); adding it later is a change-control item.
- **Email** — Resend, with a verified sending domain configured by Makerspace.
- **Hosting** — Supabase and Vercel accounts provisioned and owned by Makerspace.
- **Migration** — none. No historical documents are imported (client decision).
- No dependency on any external HR, payroll, or student information system.

---

## 11. UX / Design & Brand

Three surfaces, each built for its persona: the intern checklist (a single page answering "what do I still owe, where is it, and when does it disappear"), the approver queue (a fast list with inline preview and two primary actions, one of which applies a signature), and the admin console (a completion matrix with drill-down and a post-deletion approval record view).

**Brand:** Makerspace. Design tokens derive from the Makerspace logo colour palette. The logo file and its hex values are still needed: [NEEDS INPUT].

**Design principles:** status legible at a glance; every state-changing action confirmed; every return requires a reason; nothing destructive in one click; the deletion countdown is impossible to miss.

**Accessibility target:** WCAG 2.1 AA, verified by automated scan plus a manual keyboard pass. The signature canvas needs a non-drawing fallback — upload a PNG — for anyone who cannot draw with a pointer.

---

## 12. Assumptions, Constraints & Risks

**Assumptions.** All users have email addresses Makerspace can invite. Approval chains are sequential and at most 2 steps. Approvers act on a desktop or tablet. Documents are already digital. The 30-day retention clock starts at final approval.

**Constraints.** Two part-time intern developers over roughly 8 weeks. Free or low-tier hosting. No budget for a certificate authority or a paid e-signature service. Makerspace maintains the system afterwards, so no exotic dependencies and a real handover package.

**Risks.**

| ID | Risk | Impact | Likelihood | Mitigation | Owner |
|---|---|---|---|---|---|
| R1 | One supervisor (Carl) approves for 50–100 interns, becoming the bottleneck the system was meant to remove | H | H | Reassignment (FR-15) and the reminder digest (FR-19) are in MVP, not Should; recruit at least 1 backup approver before go-live; measure median cycle time against G1 during the pilot | Makerspace |
| R2 | The stamped signature image is mistaken for a legally certified e-signature | H | M | Appendix B fixes the definition; the attestation record is the authoritative artefact and the image is a visual convenience; certified signatures are in §6 Won't | Approver |
| R3 | 30-day deletion destroys a DTR an intern's school still needs, or that Makerspace is obliged to keep | H | M | FR-17 download plus warnings at 7 and 1 days; confirm before baseline that no school or regulatory rule requires longer retention; approval records survive deletion (FR-23) | Makerspace |
| R4 | The signature image leaks and is reused to forge approvals | H | L | Stored in a bucket with no client-readable policy; composited server-side only; covered by a dedicated adversarial test; deleted on approver offboarding | Intern A |
| R5 | Authorisation implemented only in the UI, leaving the API open | H | M | RLS mandatory from the first migration; FR-26 blocks merge in CI | Intern A |
| R6 | Interns build an ad-hoc status field instead of the state machine | H | M | Appendix A agreed and reviewed before any workflow code; illegal transitions tested explicitly | Supervisor |
| R7 | Signature compositing added to MVP squeezes the schedule | M | M | Ship approve-without-signature in week 4 and add compositing in week 5; Should items drop first | Supervisor |
| R8 | Scope creep into OCR, parallel approvals, or countersignature | M | M | Locked to §6 Could/Won't; change control after baseline | Supervisor |
| R9 | Secrets committed to the repository | H | M | Pre-commit secret scanning; vault-held secrets; CI check | Intern B |
| R10 | Handover fails and Makerspace cannot maintain the system | H | M | Runbook, admin guide, and architecture doc are week-8 deliverables with acceptance criteria; a Makerspace maintainer named before week 6 | Makerspace |
| R11 | Resend deliverability poor, so notifications are missed | M | M | Verified sending domain with SPF and DKIM; in-app status remains the source of truth | Intern A |

---

## 13. Timeline & Milestones

Eight weeks, two developers. Start date: [NEEDS INPUT].

| Week | Milestone | Exit criteria |
|---|---|---|
| 1 | Foundation | PRD signed; state machine and API contract agreed in writing; schema drafted; data inventory and privacy notice written; Makerspace brand tokens applied; repository, CI, and staging live |
| 2 | Identity & access | Invitation, login, roles, internship-date entry, and RLS working; first adversarial tests passing |
| 3–4 | Submission and approval, unsigned | Requirement definitions, upload, single approver step, approve and return, status timeline; a real DTR goes end to end on staging |
| 5 | Signature | Signature enrolment, server-side compositing onto the approved PDF, immutability, intern download |
| 6 | Retention, notifications, admin | Resend on all FR-18 events, deletion warnings, retention job, reminder digest, completion dashboard, CSV export |
| 7 | Hardening & pilot | Full FR-26 suite green; accessibility pass; backup restore rehearsed; pilot with 3–5 real DTRs and Carl signing |
| 8 | Handover | Runbook, admin guide, architecture doc, demo, QA gate sign-offs, named Makerspace maintainer briefed |

**MVP cut line.** If week 6 is at risk, the reminder digest, CSV export, and reassignment move to a post-cycle backlog. Row-level security, the audit log, the retention job with its warnings, and the adversarial test suite are never cut.

---

## 14. Open Questions

- [NEEDS INPUT] Carl's surname and formal role title, for the sign-off log and the privacy notice — owner: Makerspace
- [NEEDS INPUT] The Makerspace logo file and its hex colour values, for the design tokens — owner: Makerspace
- [NEEDS INPUT] The named individual serving as Data Protection Officer. RA 10173 requires a person, not an organisation; "Makerspace" cannot be registered with the NPC as the DPO — owner: Makerspace
- [NEEDS INPUT] Internship start and end dates for the development cycle, and the two interns' weekly hours — owner: Makerspace
- [NEEDS INPUT] Confirmation that the 30-day retention clock starts at final approval, and that no school or regulatory rule obliges Makerspace to retain DTRs longer (risk R-3) — owner: Makerspace
- [NEEDS INPUT] Resend verified sending domain — owner: Makerspace

---

## 15. Approvals

Sign-off is recorded in the accompanying sign-off log, one entry per gate, given by Carl as the named client approver. The author of this PRD does not sign it. Baseline v1.0 is set at the Final PRD approval; change control applies to every requirement thereafter.

---

## Appendix A — Submission State Machine

States: `DRAFT` · `SUBMITTED` · `IN_REVIEW` · `RETURNED` · `APPROVED` · `CANCELLED` · `EXPIRED` · `PURGED`

| From | Event | To | Who may trigger | Notes |
|---|---|---|---|---|
| — | create | DRAFT | Intern (owner) | On first file attach |
| DRAFT | submit | SUBMITTED | Intern (owner) | Version 1 sealed and hashed |
| SUBMITTED | assign step 1 | IN_REVIEW | System | Notifies the approver |
| IN_REVIEW | approve (step 1 of 2) | IN_REVIEW | Approver at current step | Advances the step pointer; no signature applied yet |
| IN_REVIEW | approve (final step) | APPROVED | Approver at final step | Signature composited; both artefacts frozen |
| IN_REVIEW | return | RETURNED | Approver at current step | Comment mandatory; no signature applied |
| RETURNED | resubmit | SUBMITTED | Intern (owner) | Creates version n+1; restarts at step 1 |
| IN_REVIEW | reassign | IN_REVIEW | Administrator | Step holder changes, reason logged |
| DRAFT / RETURNED | cancel | CANCELLED | Administrator | Reason logged |
| SUBMITTED / IN_REVIEW / RETURNED | past due + grace | EXPIRED | System job | Admin may reopen |
| APPROVED | 30 days elapsed | PURGED | System job only | File bytes deleted; approval record retained |
| EXPIRED / CANCELLED | 30 days after internship end | PURGED | System job only | File bytes deleted |
| PURGED | — | — | Nobody | Terminal; metadata and approval record remain readable by admins |

Every transition not in this table is illegal and must be rejected server-side with 409 and an audit entry (FR-13). APPROVED permits no edit and no re-upload; only the retention job may move it onward.

---

## Appendix B — What "Signed" Means in This System

An approval produces two things, and the distinction matters:

1. **The attestation record** — the approver's authenticated identity, the UTC timestamp, the step, and the SHA-256 hash of the exact file version approved, written to an append-only log. This is the authoritative proof, it is what survives the 30-day deletion, and it is what settles a dispute.
2. **The signature image** composited onto the output PDF, with the approver's printed name and the approval date. This is what a school or an external reader expects to see on a DTR. It is a visual representation of the attestation, not the proof itself.

This is deliberately not a certified electronic signature backed by a certificate authority under RA 8792, which remains out of scope (§6). Nobody should represent it as one. A stamped image is trivially copyable once the PDF is distributed, which is exactly why the attestation record — not the image — is the artefact of record, and why the signature image is protected as sensitive data in its own right (§9, R-4).
