# Post-Launch Changes

Running log of decisions made after the Week 8 handover (see `08-implementation-plan.md`),
for whoever picks this up next. Newest entries first.

## 2026-08-28 — HR bug reports + intern grouping feature

### Bug: intern document upload failing with "new row violates row-level security policy"

Root cause suspected to be migration drift: `uploadSubmission` / `resubmitSubmission` in
`lib/data/submissions.ts` uploaded via the user-context Supabase client only, with no
fallback -- the *only* two storage upload call sites in the codebase without one (compare
`enrollSignature` in `lib/data/signatures.ts`, which already had this fallback). Fixed by
adding the same service-role fallback. Also added migration
`20240101000015_reassert_submissions_upload_policy.sql` to re-assert the intended INSERT
policy directly, since the unqualified RLS error is consistent with the production
Supabase project never having received migrations `20240101000005` through `20240101000013`
(the InternDocs project was created 2026-08-20; deploy work before this only touched env
vars, never `supabase db push`). **Action item:** confirm someone has actually run
`supabase db push` against the production project — if not, migrations 000005–000016 are
still only local and several earlier RLS fixes (submissions reads, signature storage, the
DELETE-policy fix in 000011, self-role-escalation prevention in 000012) may not be live either.

### Bug: invite link pointed at localhost in production

Same root cause as the sign-out bug fixed the day before (`39ae18b`): `lib/data/auth.ts`
built the accept-invite redirect from `NEXT_PUBLIC_SITE_URL`, a build-time-inlined env var
that was never set. Fixed the same way — derive the origin from the incoming request's
`host`/`x-forwarded-proto` headers instead of an env var. `NEXT_PUBLIC_SITE_URL` is no
longer read anywhere in the app after this change.

### Bug: signature enrollment only accepted PNG

Approvers/admins with a JPG-only scan of their signature had no way to enroll it. Expanded
`SignaturePad.tsx`, `lib/data/signatures.ts`, and `lib/pdf/composite.ts` to accept and
correctly composite either PNG or JPEG (extension-aware storage path, `embedPng` vs
`embedJpg` picked from the stored file's extension). Migration
`20240101000014_expand_signature_formats.sql` lifts the Supabase Storage bucket-level MIME
allowlist, which is enforced independently of the RLS policies on `storage.objects`. Note:
JPEG has no alpha channel, so a JPEG signature stamps with an opaque background rather than
a transparent one — the enrollment UI copy calls this out but does not block JPEG uploads.

Follow-up same day: also added WebP and SVG. Neither is embeddable by `pdf-lib` directly
(it only supports `embedPng`/`embedJpg`), and SVG is a text/XML format the FR-6 magic-byte
validator (`detectMagicBytes`) was never designed to cover, so both get **rasterized to PNG
server-side at enrollment time** (`rasterizeToPng` in `lib/data/signatures.ts`, via the new
`sharp` dependency) before anything is stored — the `signatures` bucket, its RLS/mime
policies, and `lib/pdf/composite.ts` never see a raw WebP or SVG byte, so no further
migration was needed beyond `000014`. Two things worth knowing if you touch this code:
- SVG detection (`isLikelySvg`) is a fast-path text sniff only, not a security boundary —
  the real gate is `sharp`/librsvg rasterization itself, which never executes `<script>` or
  fetches remote resources and throws on anything that isn't valid SVG.
- `rasterizeToPng` caps `limitInputPixels` at 20M and resizes to at most
  `MAX_SIGNATURE_RASTER_DIMENSION` (800px) so a tiny SVG that declares an absurd
  `width`/`height` ("SVG bomb") either gets rejected outright (past the pixel limit) or
  clamped down, never decoded at full declared size. Covered by
  `__tests__/signature-format-expansion.test.ts`.

### Feature: intern groups (school + batch)

New scope beyond the PRD's MVP boundary ("one cohort at a time", `prd-intern-docflow.md`
§"MVP boundary"). Implemented as two plain nullable columns (`school`, `batch`) on
`public.users` (migration `20240101000016_intern_groups.sql`) rather than a separate groups
table/entity — there's no requirement to manage a fixed catalog of schools or batches, only
to tag and filter by them.

Scope decisions made with the user before building:
- **Visibility/filter only, no access restriction.** Every admin and approver still sees
  every intern regardless of group; this is not a new RLS dimension. If Makerspace later
  wants approvers scoped to specific schools/batches, that's a bigger follow-up change
  (new RLS policies + an approver-to-group assignment model) — not done here.
- **Set at invite time.** `AdminInviteForm` grows optional School/Batch fields, shown only
  when inviting an intern, with `<datalist>` autocomplete against already-used values (see
  `getInternGroupOptions` in `lib/data/users.ts`) to keep spelling consistent across the
  cohort. Also editable afterward inline from System Admin → Users
  (`UserManagementTable`) via the new `updateUserGroup` in `lib/data/users.ts`.
- **Filter surfaces:** the admin completion dashboard (`AdminDashboardMatrix`), the CSV
  export (`/api/admin/export`, now with School/Batch columns), the System Admin users table,
  and the approver review queue (`ApproverQueue`) all got School/Batch filter dropdowns.
  The regular Admin's Users page (`admin/users`) only has the invite form (no user list),
  so it gained the invite-time fields but no filter UI.
