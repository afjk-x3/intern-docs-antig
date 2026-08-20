# InternDocs — Backend Security Rules

Binding rules for everything under `/lib`, `/supabase`, and any route handler or Server Action. These are the architectural rules from PRD §10 expanded into checkable practice. A pull request that violates any rule in this file does not merge, regardless of what else it does correctly.

## 1. Row-level security, no exceptions

- Every table holding user data has an RLS policy from the migration that creates it. A table without a policy does not pass review — this is a hard stop, not a note for later.
- Default deny. A policy grants specific access; it never starts from open and restricts down.
- Write the adversarial test for a policy in the same PR that adds the policy, not afterward.

## 2. Server-only data access

- All database and storage access flows through `/lib/data`, and every file in that directory starts with `import 'server-only'`.
- No component, Server or Client, queries Supabase directly. If a new data need appears, add a function to the data-access layer first.
- This layer is where you'd notice a missing RLS policy during development, because the query would return nothing or error — treat that as a signal to fix the policy, never as a reason to reach for the service-role key.

## 3. The service-role key

- Never reaches the client bundle. Verify this in code review by checking the key is only referenced in server-only files.
- Never committed. Lives in the platform's encrypted store or Supabase Vault, referenced by environment variable in server contexts only.
- Never used to bypass an RLS policy "just for this one admin feature." If an admin needs broader access than a policy currently allows, the fix is a correct admin-scoped policy, not a service-role shortcut.

## 4. The signature image, specifically

- Stored in a bucket with a policy that grants no client role read access, ever, including the owning approver's own client-side session.
- The only path that reads the signature image is the server-side compositing function in `/lib/pdf`, invoked during approval.
- Serving the owner's own signature preview on their settings page uses a narrowly scoped, short-lived signed URL requested through a server action that checks the requester is the owner — this is the one legitimate exception, and it is covered by its own line in the FR-26 suite.
- Deleted on approver offboarding — this is a job, not a manual step someone might forget.

## 5. State machine enforcement

- Appendix A is encoded once, in `/lib/state-machine`, as the single source of truth. No status string comparison anywhere else in the codebase.
- Every transition attempt goes through this module server-side. A transition not in the table is rejected with 409 and an audit entry, unconditionally.
- No API endpoint or Server Action writes a submission's state column directly. All writes go through the state machine module.

## 6. Downloads and signed URLs

- Every file download is a signed URL, generated server-side after an explicit permission check tied to the requesting user's role and relationship to the submission.
- Signed URLs expire within 5 minutes.
- No signed URL is guessable or reusable beyond its stated purpose (one URL, one download intent).

## 7. Audit logging

- Audit writes happen at the data-access layer, not scattered through UI code, so no code path can mutate protected data without also logging it.
- The `audit_log` table's grants permit insert only, from the application role. No update, no delete, enforced at the database grant level, not just by the absence of a delete function in the codebase.
- Every logged event captures actor, action, target, UTC timestamp, and source IP (source IP captured at the route handler / Server Action boundary, passed into the log write).

## 8. Migrations

- One migration per schema change, numbered, in `/supabase/migrations`.
- A migration is never edited after it has been applied to staging or production. Write a new migration to correct it.
- No manual schema edits against production, ever, including "quick fixes."

## 9. Retention and deletion job

- Runs as a scheduled job (Supabase cron / pg_cron), not triggered by user action.
- Deletes file bytes only. Submission, approval, hash, comment, and audit rows are never touched by this job.
- Must confirm the FR-17 warning emails were sent before deleting a given item — the job checks this, it does not assume it.
- Every deletion writes an audit entry containing the file hash and the deletion timestamp.

## 10. Secrets and CI

- Pre-commit secret scanning is configured locally and enforced again in CI, so a bypassed local hook still gets caught.
- `.env.example` lists every required variable name with no real values. Real values never enter git history, including in a squashed or amended commit.

## 11. Definition of a mergeable PR touching this layer

- New or changed table: RLS policy included, adversarial test included
- New or changed Server Action or route handler touching protected data: audit log write included, authorization test included
- Any change near the signature path: the specific signature adversarial test still passes
- CI green: lint, typecheck, unit tests, the full FR-26 suite, secret scan
