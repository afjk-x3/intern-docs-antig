# InternDocs — Refactor Summary

This is a living log, not a one-time document. Nothing needs an entry here yet because the project has not been built. Keep this file updated as the codebase changes shape after initial implementation. Its purpose: when a maintainer at Makerspace inherits this system, they can read this file and understand why the code looks the way it does, not just what it does.

## When a change qualifies as a refactor entry

Log an entry when a change:
- Alters the shape of the state machine, the data-access layer, or an RLS policy set, without changing external behavior
- Consolidates or splits a module in a way that moves where a future developer should look for something
- Changes a security boundary (who can call what, what a policy allows) even if no bug was involved
- Reverses or significantly changes a decision recorded in `08-implementation-plan.md` or `13-plan-redo-organization.md`

Do not log routine feature work, bug fixes with no structural change, or dependency bumps here. Those belong in the git history and the PR description.

## Entry template

Copy this block for each entry, newest at the top.

```
### [YYYY-MM-DD] Short title

**Trigger.** What prompted this — a bug, a scaling problem, a review finding, a scope change.

**What changed.** Files and modules touched, in plain terms.

**What did not change.** Confirm external behavior and API contracts are unaffected, or state exactly what did change and why that was necessary.

**Risk.** What could break. What was retested (link the PR and the CI run).

**Owner.** Who made the change and who reviewed it.
```

## Log

_(no entries yet — this project has not started implementation)_

## Rules for this file

- An entry is added in the same PR as the refactor, not after the fact
- Never delete an entry; if a refactor is later reversed, add a new entry that says so and links back
- This file is part of the Week 8 handover package — a Makerspace maintainer should be able to read it top to bottom and understand the codebase's history of structural decisions
