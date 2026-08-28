-- 20240101000019_schedule_jobs.sql
--
-- Closes audit gap #18 (docs/09-project-audit.md, 2026-08-28): the retention sweep
-- (FR-17, FR-22) and the daily reminder digest (FR-19) were fully implemented in
-- lib/jobs/*.ts but nothing ever invoked them automatically -- the only trigger was a
-- manual "Run Sweep Now" button. FR-22 is one of the four items the PRD's MVP cut-line
-- (prd-intern-docflow.md §13) says is "never cut," so running only when someone
-- remembers to click a button does not satisfy it.
--
-- Per the PRD's own stack decision (§10: "Scheduled jobs | Supabase cron / pg_cron"),
-- this uses pg_cron + pg_net to call the app's own protected cron API routes
-- (src/app/api/cron/retention-sweep, src/app/api/cron/daily-digest) on a schedule,
-- rather than switching to Vercel Cron. The actual job logic (Resend emails, storage
-- deletion, the state machine) stays in TypeScript in lib/jobs -- pg_cron only triggers
-- an HTTP call into it, since that logic can't reasonably be ported to PL/pgSQL.
--
-- REQUIRED MANUAL STEP, once per environment (local / staging / each Vercel branch's
-- Supabase project), because a deployed URL and a secret cannot be safely hardcoded into
-- a checked-in migration file: after this migration is applied AND the app is deployed
-- with a CRON_SECRET env var set, run in the Supabase SQL editor (or `supabase db
-- execute`) against that environment's database:
--
--   ALTER DATABASE postgres SET app.settings.cron_target_url = 'https://<your-deployed-domain>';
--   ALTER DATABASE postgres SET app.settings.cron_secret = '<same value as the CRON_SECRET env var>';
--
-- Until both settings are configured, the scheduled jobs will fail visibly in
-- `cron.job_run_details` (queryable by a system_admin) rather than silently no-op --
-- this is deliberate, so a missed setup step is discoverable, not invisible.

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Off-hours per the NFR (no scheduled downtime 08:00-18:00 PHT / UTC+8): 18:00 UTC is
-- 02:00 the next day in Manila.
SELECT cron.schedule(
  'retention-sweep-daily',
  '0 18 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.cron_target_url') || '/api/cron/retention-sweep',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Lands at the start of the Manila business day (00:00 UTC = 08:00 PHT) so approvers
-- see it when they start work, matching FR-19's "reminder when an item has waited past
-- its target."
SELECT cron.schedule(
  'daily-digest',
  '0 0 * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.cron_target_url') || '/api/cron/daily-digest',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.settings.cron_secret'),
      'Content-Type', 'application/json'
    ),
    body := '{}'::jsonb
  );
  $$
);
