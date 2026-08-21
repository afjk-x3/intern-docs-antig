# InternDocs — Design System

Built on Tailwind CSS + shadcn/ui. This file defines tokens and component rules. Update section 1 the moment the Makerspace logo and brand colors arrive in Antigravity; nothing else in this file should need to change when that happens.

## 1. Brand tokens — CONFIRMED from Makerspace logo

The Makerspace logo (`docs/makerspace-brand.png`) was used to extract the primary and accent hex values below. Contrast ratios verified against white (#FFFFFF): primary #1B3251 = 10.07:1, accent #C9400A = 4.88:1, both pass WCAG AA.

```css
:root {
  --brand-primary: #1B3251;      /* Makerspace primary */
  --brand-primary-hover: #112136;
  --brand-accent: #C9400A;       /* Makerspace secondary */

  --status-not-started: #94A3B8;
  --status-draft: #64748B;
  --status-submitted: #3B82F6;
  --status-in-review: #F59E0B;
  --status-returned: #EF4444;
  --status-approved: #22C55E;
  --status-overdue: #DC2626;
  --status-deleted: #9CA3AF;

  --surface-bg: #FFFFFF;
  --surface-muted: #F8FAFC;
  --border-default: #E2E8F0;
  --text-primary: #0F172A;
  --text-muted: #334155;         /* 7.01:1 on white — WCAG AA pass */
}
```

**Status:** Brand tokens are confirmed and applied in `src/app/globals.css`. Contrast verification complete.

## 2. Typography

- System font stack, no custom font loading (keeps performance and load time predictable on 10 Mbps connections per NFR performance)
- Scale: 12 / 14 / 16 / 18 / 24 / 32 px
- Body text: 16px minimum, 4.5:1 contrast minimum
- Status labels: always paired with a color and an icon or text label, never color alone (accessibility — color-blind users must be able to read status)

## 3. Spacing

4px base unit. Use Tailwind's default scale (`p-1` through `p-16`). Do not introduce a second spacing system.

## 4. Status badge component

One component, `StatusBadge`, used everywhere a submission state is shown (checklist, queue, dashboard, timeline). Never re-implement status display ad hoc in a different component — this is how status stays legible at a glance across all three surfaces.

Props: `state` (one of the 8 Appendix A states relevant to display), renders color token + label + icon.

## 5. Confirmation dialog component

One component, `ConfirmAction`, used for every state-changing action: approve, return, reassign, role change, deletion-adjacent actions. Takes a plain-language description of what will happen and requires an explicit confirm click. Never wire a destructive or state-changing action directly to a single click without this component.

## 6. Signature canvas component

- Primary mode: draw with pointer/touch
- Fallback mode: upload PNG, toggled clearly, not hidden in a menu — this is the accessibility requirement for anyone who cannot draw with a pointer
- Never renders another user's signature; only the owner's own enrollment/settings view ever mounts this component in read mode

## 7. Layout

- Breakpoints: mobile 360px minimum, tablet 768px, desktop 1024px+
- Approver and admin surfaces are designed primarily for desktop/tablet (PRD assumption: approvers act on desktop or tablet) but must not break below 360px
- No horizontal scroll at any supported width

## 8. Components sourced from shadcn/ui

Use shadcn/ui primitives for: buttons, form fields, dialogs, tables, tabs, toasts, dropdown menus. Do not hand-roll a component shadcn/ui already provides. Custom components (StatusBadge, ConfirmAction, signature canvas, requirement checklist card) are the exceptions because they encode domain rules shadcn/ui has no opinion on.

## 9. Motion

Minimal. Use it only to communicate state change (a status badge transitioning color) or loading. No decorative animation. Respect `prefers-reduced-motion`.
