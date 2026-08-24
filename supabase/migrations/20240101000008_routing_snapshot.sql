-- 20240101000008_routing_snapshot.sql
-- FR-8: Snapshot routing template at submission time so in-flight submissions
-- keep the revision they started on, even if the template is later edited.

ALTER TABLE public.submissions
  ADD COLUMN IF NOT EXISTS routing_snapshot JSONB;

COMMENT ON COLUMN public.submissions.routing_snapshot IS
  'FR-8: Frozen copy of the routing template steps at submission time. In-flight submissions use this, not the live template.';
