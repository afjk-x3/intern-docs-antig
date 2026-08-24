# InternDocs: Agent Onboarding

## What this system does

InternDocs replaces email and chat threads for tracking intern requirements at Makerspace. Interns upload documents. Supervisors review and sign them through server-side PDF signature compositing. Administrators track compliance across the cohort.

Stack: Next.js 16 (App Router), Supabase (PostgreSQL, Auth, Storage), Tailwind CSS, Zod.

## Non-negotiable constraints

- DTRs count as personal data under the Philippine Data Privacy Act (RA 10173).
- Documents auto-delete after 30 days.
- Approval records stay immutable and are retained for 3 years.
- Row-Level Security enforces every database access path.
- Security and workflow events log to an append-only audit trail. Nothing gets deleted or edited after the fact.

## Read `/docs` before you touch code

This project trains two interns and hands off to Makerspace for long-term maintenance. Documentation is a deliverable, not a byproduct. `/docs` is the source of truth. Read the relevant files before proposing any change.

| File | What it defines |
|---|---|
| `prd-intern-docflow.md` | User personas, workflow states, out-of-scope features |
| Security & architecture docs | RLS rules, adversarial test cases, data retention limits |
| Design system docs | WCAG 2.1 AA rules, Makerspace brand tokens |
| Implementation plans & audits | Past decisions, refactors, QA gates |

## Working rules

- Check `/docs` before proposing a feature or architecture change.
- Never bypass RLS, retention, or audit-logging rules, even for a quick fix.
- Flag any change that touches DTR handling or the 30-day deletion job for extra review.
- Update `/docs` when you make a decision that future maintainers need to know.