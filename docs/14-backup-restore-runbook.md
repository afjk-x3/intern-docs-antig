# Backup & Restore Rehearsal Runbook

> **Project**: InternDocs  
> **Last rehearsed**: 2026-08-28 (local)  
> **Next scheduled rehearsal**: _quarterly_

## Overview

This runbook covers backup and restore procedures for all InternDocs data:

1. **PostgreSQL database** (schema + data)
2. **Supabase Storage** (buckets: `submissions`, `templates`, `signatures`)
3. **Verification queries** to confirm restore integrity

InternDocs handles DTRs classified as personal data under RA 10173. The 30-day auto-deletion policy and 3-year approval retention rule mean that a restore from backup could reintroduce data that should have been purged. The verification step below accounts for this.

---

## Prerequisites

- Supabase CLI installed (`npx supabase --version` ≥ 2.x)
- `SUPABASE_ACCESS_TOKEN` set in environment (or logged in via `npx supabase login`)
- Project ref available: check `supabase/config.toml` → `project_id`
- For hosted projects: database connection string from Supabase Dashboard → Settings → Database
- Write access to a secure backup directory (encrypted at rest)

---

## 1. Database Backup

### 1a. Local (Supabase CLI)

> **Corrected 2026-08-27, from an actual rehearsal**: `supabase db dump` (CLI 2.116.0) has **no combined "schema + data" mode** — without `--data-only` it dumps schema only (confirmed empty of `INSERT`/`COPY` statements), matching the "Schema-only" example below. Schema doesn't need backing up separately in practice anyway: it's fully reproducible from `supabase/migrations/*.sql`, already version-controlled in git. What actually needs backing up is data, and — because `public.users.id` and `audit_log.actor_id` reference `auth.users(id)` — that means the `auth` schema too, not just `public`.

```bash
# Data-only dump, public + auth schemas (this is the one that matters for DR)
npx supabase db dump --local --data-only --use-copy --schema public,auth \
  -f backup_$(date +%Y%m%d_%H%M%S).sql

# Schema-only dump (for migration drift verification, not routine backup)
npx supabase db dump --local --schema-only -f schema_$(date +%Y%m%d_%H%M%S).sql
```

### 1b. Hosted (production / staging)

```bash
# Full dump from hosted project
npx supabase db dump --linked -f backup_prod_$(date +%Y%m%d_%H%M%S).sql

# Or use pg_dump directly with the connection string
# (get the real one from Supabase Dashboard -> Settings -> Database; never paste it into this file)
pg_dump "$SUPABASE_DB_CONNECTION_STRING" \
  --format=custom \
  --file=backup_prod_$(date +%Y%m%d_%H%M%S).dump
```

### 1c. What gets backed up

| Table | Contains | Retention note |
|---|---|---|
| `users` | Intern/approver/admin profiles | Retained while active |
| `submissions` | Workflow state, holder, due dates | Retained for 3 years |
| `submission_versions` | File URLs, hashes, `deleted_at` | File bytes purged at 30 days; row retained |
| `approvals` | Immutable approval records | Retained for 3 years minimum |
| `audit_log` | Append-only security events | Never deleted |
| `users.privacy_acknowledged_at` | Privacy notice consent timestamp (FR-25) — a column on `users`, not a separate table | Never cleared once set |
| `notifications` | User notifications | Retained while active |
| `requirements` | Document requirement definitions | Retained indefinitely |
| `routing_templates` | Approval workflow definitions | Retained indefinitely |

---

## 2. Storage Backup

Supabase Storage buckets are **not** included in `pg_dump`. Back them up separately.

> **Corrected 2026-08-28, from an actual rehearsal**: `supabase storage cp`/`ls` against
> `--local` failed outright on CLI 2.116.0 -- first `LegacyExperimentalRequiredError`
> (needs `--experimental`), then `LegacyStorageUnsupportedOperationError: Unsupported
> operation` on every `ss:///` local copy attempted (single-file and `-r` directory
> alike), even with the storage-api container confirmed healthy. This may be
> version-specific or `--linked` (hosted) may behave differently -- not confirmed either
> way, since a rehearsal must never touch the hosted project. **What is confirmed
> working**, and is what actually got rehearsed: the same `@supabase/supabase-js`
> `.storage.from(bucket).upload/download/list/remove()` calls the application code
> itself uses (`lib/data/signatures.ts`, `lib/data/submissions.ts`,
> `lib/data/requirements.ts`), driven from a small script against the service-role key.
> This is arguably the more representative rehearsal anyway -- it's the exact code path
> real backups would need to replicate. If the CLI commands below work in your
> environment, prefer them for convenience; if not, fall back to the JS SDK approach.

### 2a. List all objects in each bucket

```bash
# List objects in each private bucket
npx supabase storage ls submissions --linked
npx supabase storage ls templates --linked
npx supabase storage ls signatures --linked
```

### 2b. Download all objects

```bash
# Download entire bucket contents to local directory
mkdir -p ./backup_storage/submissions ./backup_storage/templates ./backup_storage/signatures

npx supabase storage cp -r ss:///submissions ./backup_storage/submissions --linked
npx supabase storage cp -r ss:///templates ./backup_storage/templates --linked
npx supabase storage cp -r ss:///signatures ./backup_storage/signatures --linked
```

### 2c. Verify download integrity

```bash
# Count files downloaded vs listed
find ./backup_storage -type f | wc -l
```

### 2d. JS SDK fallback (confirmed working, 2026-08-28 rehearsal)

```js
// Same client shape as lib/supabase/admin.ts, pointed at whichever project you're
// backing up. For each bucket: list(prefix), download(path) each object, write bytes
// to ./backup_storage/<bucket>/<path> preserving the storage path structure.
const { data } = await client.storage.from(bucket).download(path);
const buf = Buffer.from(await data.arrayBuffer());
```

---

## 3. Database Restore

> [!CAUTION]
> Restoring to production will **overwrite** all current data. Always restore to a staging instance first.

### 3a. Restore to a clean local instance

```bash
# Reset local DB and replay migrations -- recreates the auth/storage schemas too,
# not just public, so do this BEFORE restoring the data dump, not instead of it
npx supabase db reset

# Then restore the data dump on top
psql "postgresql://postgres:postgres@localhost:54332/postgres" < backup_20260825_120000.sql
```

> **Gotcha confirmed by rehearsal**: `routing_templates` and `requirements` are seeded directly by `20240101000002_phase2_requirements_submissions.sql`, so after a fresh `db reset` those two tables already have the same rows the dump also contains. Restoring the dump on top throws a harmless `duplicate key value` error for those two tables specifically (everything else restores clean) -- expected, not data loss, since the rows are identical. If this gets noisy, exclude them with `--exclude public.routing_templates --exclude public.requirements` on the dump, or restore those two tables' data with `ON CONFLICT (id) DO NOTHING`.

### 3b. Restore to staging (pg_restore for custom format)

```bash
pg_restore \
  --clean --if-exists \
  --no-owner --no-privileges \
  -d "$STAGING_DB_CONNECTION_STRING" \
  backup_prod_20260825_120000.dump
```

### 3c. Re-apply migrations if schema-only restore

```bash
# Push all migrations to restored instance
npx supabase db push --linked
```

---

## 4. Storage Restore

```bash
# Upload backed-up files back to storage buckets
npx supabase storage cp -r ./backup_storage/submissions ss:///submissions --linked
npx supabase storage cp -r ./backup_storage/templates ss:///templates --linked
npx supabase storage cp -r ./backup_storage/signatures ss:///signatures --linked
```

If the CLI commands above don't work (see the section 2 note), the JS SDK fallback:

```js
const buf = readFileSync(localBackupPath);
const { error } = await client.storage.from(bucket).upload(path, buf, { upsert: true, contentType });
```

---

## 5. Verification Queries

Run these queries after every restore to confirm data integrity.

### 5a. Row counts (compare against pre-backup counts)

```sql
SELECT 'users' AS table_name, COUNT(*) AS row_count FROM public.users
UNION ALL SELECT 'submissions', COUNT(*) FROM public.submissions
UNION ALL SELECT 'submission_versions', COUNT(*) FROM public.submission_versions
UNION ALL SELECT 'approvals', COUNT(*) FROM public.approvals
UNION ALL SELECT 'audit_log', COUNT(*) FROM public.audit_log
UNION ALL SELECT 'users_privacy_acknowledged', COUNT(*) FROM public.users WHERE privacy_acknowledged_at IS NOT NULL
UNION ALL SELECT 'notifications', COUNT(*) FROM public.notifications
UNION ALL SELECT 'requirements', COUNT(*) FROM public.requirements
UNION ALL SELECT 'routing_templates', COUNT(*) FROM public.routing_templates
ORDER BY table_name;
```

### 5b. RLS is active on all tables

```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
-- Every row should show rowsecurity = true
```

### 5c. Append-only constraints intact

```sql
-- Verify audit_log cannot be updated/deleted (its own REVOKE, migration 0/10)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_name = 'audit_log'
  AND privilege_type IN ('UPDATE', 'DELETE', 'TRUNCATE')
  AND grantee IN ('authenticated', 'anon', 'public');
-- Should return 0 rows
```

### 5d. Retention compliance — no stale file bytes

```sql
-- Files older than 30 days should have deleted_at set (bytes purged)
SELECT id, created_at, deleted_at
FROM public.submission_versions
WHERE created_at < NOW() - INTERVAL '30 days'
  AND deleted_at IS NULL;
-- Non-empty result means retention job needs to run post-restore
```

### 5e. Approval immutability check

```sql
-- Approvals should never have been modified (compare created_at range)
SELECT COUNT(*) AS total_approvals,
       MIN(created_at) AS earliest,
       MAX(created_at) AS latest
FROM public.approvals;
```

### 5f. Storage bucket configuration

```sql
-- Verify buckets are private
SELECT id, name, public
FROM storage.buckets
WHERE id IN ('submissions', 'templates', 'signatures');
-- All should show public = false
```

---

## 6. Rollback Procedure

If the restore is incorrect or corrupts data:

1. **Do NOT run any further writes** — stop the application immediately.
2. **Re-restore from the original backup** using the steps in sections 3 and 4.
3. **If no backup exists**, contact Supabase support for point-in-time recovery (PITR) — available on Pro plans and above.
4. **Log the incident** in `audit_log` manually via service role:

```sql
INSERT INTO public.audit_log (actor_id, action, target_type, payload)
VALUES (
  NULL,
  'EMERGENCY_RESTORE',
  'database',
  jsonb_build_object(
    'reason', 'Restore from backup failed, rolled back',
    'timestamp', NOW()::text
  )
);
```

---

## 7. Rehearsal Checklist

Use this checklist each time you rehearse the backup/restore cycle.

- [x] **Pre-backup**: Record row counts for all tables (query 5a)
- [x] **Backup**: Run database dump (section 1)
- [x] **Backup**: Run storage download (section 2) — exercised 2026-08-28 via the JS SDK fallback, see log below
- [x] **Restore**: Reset a clean local instance and restore the dump (section 3a)
- [x] **Restore**: Upload storage files to the clean instance (section 4) — exercised 2026-08-28
- [x] **Verify**: Row counts match pre-backup (query 5a)
- [x] **Verify**: RLS is enabled on all tables (query 5b)
- [x] **Verify**: Append-only constraints intact (query 5c)
- [ ] **Verify**: No stale file bytes violating retention (query 5d) — still not exercised; needs a rehearsal dataset with a submission old enough to be retention-eligible, which this pass (same as 2026-08-27) did not seed
- [x] **Verify**: Storage buckets are private (query 5f)
- [x] **Sign-off**: Record date and result below

### Rehearsal Log

| Date | Performed by | Environment | Result | Notes |
|---|---|---|---|---|
| 2026-08-27 | Claude (session work, on behalf of the user) | local (Docker, `supabase db reset` disaster simulation) | **Success** | Seeded one realistic row per table (user, submission, version, approval, audit entry), recorded baseline counts, took a real `--data-only --use-copy --schema public,auth` dump, wiped the DB via `db reset`, restored the dump, and confirmed row counts matched exactly and a joined query across all 4 restored tables reproduced the seeded record intact. RLS-enabled and append-only-grant checks (5b/5c) and the private-bucket check (5f) all passed post-restore. Storage object backup/restore (section 2/4) and the stale-file-bytes check (5d) were **not exercised** -- the rehearsal dataset had no actual file bytes uploaded and nothing old enough to be retention-eligible. This runbook itself had two inaccuracies corrected in this pass: `db dump` without `--data-only` is schema-only, not "schema + data" as previously written, and `privacy_acknowledgements` was documented as a table before FR-25 shipped it as a `users.privacy_acknowledged_at` column instead. All rehearsal data and dump files were deleted afterward; nothing from this rehearsal was committed. |
| 2026-08-28 | Claude (session work, on behalf of the user) | local (Docker) | **Success** | Closed the one gap the 2026-08-27 rehearsal explicitly left open: storage object backup/restore, with real file bytes, across all three buckets. Uploaded a distinct real object to `submissions`, `templates`, and `signatures` (a PNG for `signatures` specifically -- that bucket rejects non-image mime types, confirming FR-9's upload validation is enforced at the storage-policy level too, not just in `lib/data/signatures.ts`), recorded each object's SHA-256, downloaded all three to a local `./backup_storage/` mirroring the bucket/path structure, deleted the originals from storage to simulate total loss (confirmed empty via `list()`), re-uploaded from the local backup, then independently re-downloaded and re-hashed all three -- every hash matched the original upload byte-for-byte. `supabase storage cp`/`ls` against `--local` did not work on the installed CLI (2.116.0) -- see the corrected section 2 note for the exact errors and the working JS SDK fallback used instead, which is now the rehearsal's primary documented method until the CLI path is reconfirmed. Query 5d (stale file bytes) remains unexercised -- still needs a submission old enough to be retention-eligible, which is a data-seeding gap, not a mechanism gap. All rehearsal objects, the local `./backup_storage/` directory, and the throwaway Node script used to drive it were deleted after verification; nothing from this rehearsal was committed. |
