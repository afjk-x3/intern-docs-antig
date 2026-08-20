# InternDocs — Developer Guide

For Antigravity and any human developer picking up this repo. Read this before touching code. Read `12-backend-security-rules.md` and `11-frontend-ui-rules.md` before touching security-relevant or UI code respectively.

## 1. Stack

- Next.js 16, App Router, TypeScript strict mode
- Supabase: Postgres, Auth (`@supabase/ssr`), Storage
- pdf-lib for server-side signature compositing
- Tailwind CSS + shadcn/ui
- Zod for validation, shared between client and server
- Resend for email
- Vitest for unit and authorization tests, Playwright for end-to-end
- Vercel for hosting

Do not substitute any of these without a change-control note in `13-plan-redo-organization.md`. MongoDB was evaluated and rejected in the PRD; do not revisit it.

## 2. Repository structure

```
/app
  /(auth)/login
  /(auth)/accept-invite
  /(intern)/checklist          # landing page after login for interns
  /(intern)/submissions/[id]
  /(approver)/queue
  /(approver)/settings/signature
  /(admin)/dashboard
  /(admin)/requirements
  /(admin)/routing-templates
  /(admin)/users
  /(admin)/audit-log
  /api/... (route handlers only where a Server Action does not fit, e.g. webhooks)
/lib
  /data           # server-only data-access layer, import 'server-only' at top of every file
  /state-machine  # Appendix A encoded as typed transitions, single source of truth
  /validation     # Zod schemas, imported by both client and server
  /pdf            # pdf-lib compositing logic
  /email          # Resend templates and send functions
  /jobs           # retention sweep, reminder digest, deletion warnings
/components
  /ui             # shadcn/ui primitives
  /checklist
  /queue
  /admin
/supabase
  /migrations     # every schema change is a numbered migration file, no manual prod edits
  /policies       # RLS policy SQL, one file per table
/tests
  /unit
  /auth           # the FR-26 adversarial suite lives here
  /e2e
/docs             # this doc set
```

## 3. Environment

Copy `.env.example` to `.env.local`. Never commit `.env.local`. Required variables:

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # server-only, never in client bundle
RESEND_API_KEY=
RESEND_FROM_DOMAIN=
```

## 4. Local development

1. `supabase start` to run the local stack
2. `supabase db reset` to apply all migrations fresh
3. `npm run dev`
4. Seed data lives in `supabase/seed.sql`: one admin, one approver, three interns, the two seeded requirement types

## 5. Git workflow

- No direct commits to `main`. Every change lands via pull request.
- Branch naming: `fr-<number>-short-description` or `chore-short-description`
- PR must reference the FR or NFR it implements
- CI must be green: lint, typecheck, unit tests, the FR-26 suite, secret scan
- One approving review minimum, since both interns are learning; review each other's PRs

## 6. Testing discipline

- Every server action or route handler that touches a table with RLS gets an authorization test in `tests/auth` before it is considered done
- Unit test coverage target: 70% minimum on workflow, signature, and authorization modules (NFR maintainability)
- Playwright covers the three end-to-end paths: intern submits, approver signs, admin exports
- Run the full FR-26 suite locally before opening a PR that touches access control

## 7. Migrations

- One migration per schema change, numbered, checked into `supabase/migrations`
- A migration that adds a table must add its RLS policy in the same PR — a table without a policy fails review
- Never edit a migration that has already been applied to staging or production; write a new one

## 8. What "done" means for a task

A task in `01-tasks.md` is done when:
- The acceptance criteria in the matching FR pass
- An authorization test exists if the change touches a protected table or action
- The audit log captures the event if the FR requires it
- CI is green
- The task is checked off in `01-tasks.md`

## 9. Handover artifacts (Week 8)

This dev guide, the architecture summary below, and `09-project-audit.md` form the technical half of the handover package. The runbook and admin guide are separate documents written in Week 8 and are not part of this doc set; produce them then.

## 10. Architecture summary (fill in as built)

- [ ] Diagram: request path from browser to Postgres, showing where RLS and the data-access layer sit
- [ ] Diagram: submission lifecycle through the state machine
- [ ] Diagram: signature compositing path, showing the image never touches the browser
- [ ] List of scheduled jobs and their cron expressions
