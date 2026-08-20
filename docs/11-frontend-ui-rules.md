# InternDocs — Frontend UI Rules

Binding rules for anything under `/app` and `/components`. Pair with `07-design-system.md` for visual tokens and `03-design-spec.md` for surface-specific behavior.

## 1. Server Components first

- Default every component to a Server Component. Add `'use client'` only when the component needs interactivity (form state, canvas drawing, client-side validation feedback) that cannot happen on the server.
- Data fetching happens in Server Components or Server Actions, calling the server-only data-access layer (`lib/data`). No component queries Supabase directly from the client.
- This is the architecture that keeps authorization on the server (PRD §10, architectural rule 2) — a client-side data fetch is not just a style violation, it is a security gap.

## 2. Forms and mutations

- Use Server Actions for mutations (submit, approve, return, reassign, invite, role change). No client-side `fetch` to a hand-rolled API route for actions that have a Server Action equivalent.
- Every form's client-side Zod schema is the same schema the server validates against, imported from `lib/validation`, never duplicated.
- Client-side validation is a UX convenience. It is never a substitute for server-side validation. Assume every request can arrive without having gone through the form.

## 3. State-changing actions require confirmation

- Every action that changes a submission's state (approve, return, reassign, cancel) or a user's access (invite, role change, offboard) goes through the `ConfirmAction` component from `07-design-system.md`.
- No destructive or state-changing action is wired directly to a single click.

## 4. Status display

- Every place a submission state appears uses the `StatusBadge` component. Do not build a second way to render status.
- Status is never conveyed by color alone. Pair color with a text label or icon.

## 5. The signature image

- No client component ever requests, stores, or renders another user's signature image.
- The only place a signature image is fetched to a browser at all is the owner's own settings/enrollment page, and only for that owner's own signature.
- If a component needs to show that a document is signed, show the composited PDF (already a flattened file with no separately fetchable image data), never the raw signature asset.

## 6. Accessibility (non-negotiable, WCAG 2.1 AA)

- Every interactive element is reachable and operable by keyboard alone; test this manually, automated scans do not catch everything
- Body text contrast at least 4.5:1 against its background
- The signature canvas has a non-drawing fallback (PNG upload) that is equally discoverable, not hidden behind an extra click
- Form errors are announced to assistive technology (associate error text with its field via `aria-describedby`, not just visual proximity)
- `prefers-reduced-motion` respected wherever motion is used

## 7. Responsive behavior

- Usable at 360px width with no horizontal scroll, on every surface, including the admin dashboard's matrix (use horizontal scroll inside the matrix container if needed, not on the page)
- Approver and admin surfaces can assume desktop/tablet as the primary use case but must not break on mobile

## 8. Error and empty states

- Every list or matrix has a designed empty state, not a blank area
- Errors state what happened and what to do next; never show a raw stack trace or a generic "something went wrong" to the user
- Network/loading states use skeletons or spinners consistent with shadcn/ui patterns, not custom one-off spinners

## 9. What not to do

- Do not introduce a second component library alongside shadcn/ui
- Do not add client-side routing logic that duplicates what the App Router already does
- Do not fetch the database directly from a Client Component, ever, including "just for this one read-only view"
- Do not build a new status representation instead of reusing `StatusBadge`
- Do not add decorative animation, marketing copy, or any content not called for in `03-design-spec.md` or `04-homepage-design-plan.md`
