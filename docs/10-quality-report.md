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
| Gate 1 | Not started | | |
| Gate 2 | Not started | | |
| Gate 3 | Not started | | |
| Gate 4 | Not started | | |
| Gate 5 | Not started | | |

## Quality metrics (NFR §8) — track against these, not vibes

| Metric | Target | Current | Last measured |
|---|---|---|---|
| Unit/integration coverage, workflow modules | ≥70% | — | — |
| Unit/integration coverage, signature modules | ≥70% | — | — |
| Unit/integration coverage, authorization modules | ≥70% | — | — |
| Page interaction response, p95 | <500ms | — | — |
| Admin dashboard render, 100 interns × 10 requirements | <3s | — | — |
| Upload of 20MB file on 10Mbps | <30s | — | — |
| Signature compositing | <5s | — | — |
| Direct commits to main | 0 | — | — |
| PRs merged without review | 0 | — | — |
| FR-26 adversarial scenarios passing | 7/7, every PR | — | — |
| WCAG 2.1 AA automated scan | 0 critical/serious violations | — | — |
| Secrets found in repo or client bundle | 0 | — | — |

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

_(no defects logged yet)_
