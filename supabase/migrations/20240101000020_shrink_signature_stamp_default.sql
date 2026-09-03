-- 20240101000020_shrink_signature_stamp_default.sql
--
-- createRequirement() (lib/data/requirements.ts) hardcoded every new requirement's
-- signature_config to a 160x60pt stamp -- visibly too large relative to the printed
-- name/date text beneath it once actually composited onto a document. Shrunk the
-- code default to 90x34pt; this backfills existing requirements that still carry the
-- old default (there is no UI to customize signature_config, so every requirement
-- created before this migration has it verbatim).
--
-- Scoped to rows matching the old default exactly, so any row that somehow already
-- differs is left alone rather than silently overwritten.

UPDATE public.requirements
SET signature_config = jsonb_set(
  jsonb_set(signature_config, '{width}', '90'::jsonb),
  '{height}', '34'::jsonb
)
WHERE (signature_config->>'width')::numeric = 160
  AND (signature_config->>'height')::numeric = 60;
