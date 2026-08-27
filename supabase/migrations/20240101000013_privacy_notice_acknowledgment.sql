-- FR-25 (G5): "A privacy notice is shown and acknowledged at first login and the
-- acknowledgement recorded." One timestamp per user is sufficient for the current
-- single-version notice; NULL means not yet acknowledged.
--
-- No RLS change needed: "Users can update own row" (migration 0) already lets a
-- user set this column on their own row, and the self-role-escalation trigger from
-- migration 12 only restricts changes to `role`, not this column.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS privacy_acknowledged_at TIMESTAMPTZ;
