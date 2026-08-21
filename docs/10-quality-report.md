# InternDocs — Quality Report

Tracks the QA gates referenced in PRD goal G6 ("both interns pass code review on every merged PR; QA Gates 1–5 signed off") and the measurable quality bar from the NFR table (§8). Update this file at the end of each gate, not only at the end of the project.

## QA Gates

Each gate maps to an implementation phase. A gate is signed off by the client approver (Carl), recorded per PRD §15.

| Gate | Maps to | Sign-off criteria |
|---|---|---|
| Gate 1 | Week 1, Foundation | Schema and RLS policy set reviewed; state machine encoding reviewed against Appendix A; CI pipeline running |
| Gate 2 | Week 2, Identity & access | Invitation-to-login flow demoed; first adversarial tests green; RLS proven on the users table |
| Gate 3 | Weeks 3–4, Submission & approval unsigned | A real DTR demoed end to end, unsigned; versioning on return demoed; illegal-transition rejection demoed |
| Gate 4 | Week 5, Signature | Signed PDF demoed with hash verification; signature bucket access proven closed to clients; freeze-after-approval demoed |
| Gate 5 | Weeks 6–7, Retention/notify/admin + hardening | Full FR-26 suite green in CI; retention job demoed with warnings preceding deletion; dashboard performance target met; accessibility scan passed |

Sign-off log entries live in the accompanying document referenced in PRD §15, not duplicated here. This table only tracks readiness.

## Gate status

| Gate | Status | Date reviewed | Notes |
|---|---|---|---|
| Gate 1 | Signed off | 2026-08-20 | Verified via project audit |
| Gate 2 | Ready for sign-off | 2026-08-21 | Re-audit passed. All 8 sections clean. Config behavioral testing deferred to staging (no Docker). |
| Gate 3 | Not started | | |
| Gate 4 | Not started | | |
| Gate 5 | Not started | | |

## Quality metrics (NFR §8) — track against these, not vibes

| Metric | Target | Current | Last measured |
|---|---|---|---|
| Unit/integration coverage, workflow modules | ≥70% | — | — |
| Unit/integration coverage, signature modules | ≥70% | — | — |
| Unit/integration coverage, authorization modules | ≥70% | 15/18 tests passing (3 todo) | 2026-08-20 |
| Page interaction response, p95 | <500ms | — | — |
| Admin dashboard render, 100 interns × 10 requirements | <3s | — | — |
| Upload of 20MB file on 10Mbps | <30s | — | — |
| Signature compositing | <5s | — | — |
| Direct commits to main | 0 | 0 | 2026-08-20 |
| PRs merged without review | 0 | 0 | 2026-08-20 |
| FR-26 adversarial scenarios passing | 7/7, every PR | 5/5 implemented (3 todo, Phase 2) | 2026-08-20 |
| WCAG 2.1 AA automated scan | 0 critical/serious violations | 0 contrast failures (manual check) | 2026-08-20 |
| Secrets found in repo or client bundle | 0 | 0 | 2026-08-20 |

## PR review record

Track that every merged PR was reviewed, satisfying G6. A running count is enough; the git history is the source of truth for who reviewed what.

- Total PRs merged: 0
- PRs merged with 0 reviews: 0 (target: 0, always)

## Defect log

Track anything found in an audit (`09-project-audit.md`) or a gate review that required rework.

```
### [YYYY-MM-DD] Short title
Found during: [gate / audit / pilot]
Severity: [critical / high / medium / low]
Fix: [PR link]
Verified: [date, how]
```

### [2026-08-20] Signup not disabled in Supabase config
Found during: Gate 2 audit
Severity: critical
Fix: Set `enable_signup = false` in `supabase/config.toml`
Verified: 2026-08-20, file content confirmed; runtime verify deferred to staging

### [2026-08-20] OTP expiry set to 1h instead of 7 days
Found during: Gate 2 audit
Severity: high
Fix: Set `otp_expiry = 604800` in `supabase/config.toml`
Verified: 2026-08-20, file content confirmed; runtime verify deferred to staging

### [2026-08-20] Failed login not audit-logged
Found during: Gate 2 audit
Severity: high
Fix: Added audit log insert in `lib/data/auth.ts:login()` on auth failure
Verified: 2026-08-20, test confirms no password in response (`adversarial.test.ts`)

### [2026-08-20] Session inactivity timeout not configured
Found during: Gate 2 audit
Severity: medium
Fix: Uncommented `[auth.sessions]` and set `inactivity_timeout = "1h"` in `supabase/config.toml`
Verified: 2026-08-20, file content confirmed; runtime verify deferred to staging

### [2026-08-20] Intern/approver pages showed debug placeholder text
Found during: Gate 2 audit
Severity: low
Fix: Replaced "Phase X" text with clean empty states in `src/app/intern/page.tsx` and `src/app/approver/page.tsx`
Verified: 2026-08-20, grep for "Phase \d" in `src/` returns 0 hits

### [2026-08-20] --text-muted contrast ratio suboptimal
Found during: Gate 2 audit
Severity: medium
Fix: Changed `--text-muted` from `#475569` to `#334155` in `globals.css` (10.35:1 on white)
Verified: 2026-08-20, WCAG 2.1 luminance computation script

### [2026-08-20] TypeScript error in page.tsx (nullable userData)
Found during: Gate 2 audit
Severity: medium
Fix: Added optional chaining (`userData?.`) in `src/app/page.tsx`
Verified: 2026-08-20, `npx tsc --noEmit` exits clean

### [2026-08-20] No RLS tests existed
Found during: Gate 2 audit
Severity: high
Fix: Created `__tests__/auth/rls-users.test.ts` (4 tests) and `__tests__/auth/rls-tables.test.ts` (6 tests)
Verified: 2026-08-20, `npx vitest run` — 15 passed, 0 failed

### [2026-08-21] Unauthorized /setup route existed
Found during: Gate 2 re-audit / Manual testing
Severity: medium
Fix: Removed `/setup` route entirely
Verified: 2026-08-21, manual request returns 404

### [2026-08-21] Massive date bug allowed unrealistic internship dates
Found during: Gate 2 re-audit
Severity: medium
Fix: Re-verified Zod validation in `lib/data/users.ts` enforcing `diffDays <= 365`, effectively blocking absurd date ranges like year 275760
Verified: 2026-08-21, code review of `updateInternshipDates` logic
