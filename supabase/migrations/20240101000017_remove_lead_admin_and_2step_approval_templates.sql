-- 20240101000017_remove_lead_admin_and_2step_approval_templates.sql
--
-- Removes two routing templates the admin console no longer offers:
--   - "Two-Step Lead & Admin Review" (seeded in 20240101000002 as id 002)
--   - "2-Step Approval" (created later via the admin UI, so it has no fixed id --
--     matched by name as a fallback in case another environment recreated it
--     with a different uuid)
--
-- Any requirement still pointed at one of these templates is reassigned to
-- routing_template_id = NULL, which the submission flow already treats as a
-- valid state (falls back to a single default-approver step -- see
-- lib/data/submissions.ts, step1 fallback). Several requirements already run
-- with a null routing template, so this is not a new code path.

UPDATE public.requirements
SET routing_template_id = NULL
WHERE routing_template_id IN (
  SELECT id FROM public.routing_templates
  WHERE id = '00000000-0000-0000-0000-000000000002'
     OR name IN ('Two-Step Lead & Admin Review', '2-Step Approval', '2-Step Approval ')
);

INSERT INTO public.audit_log (action, target_id, target_type, source_ip)
SELECT 'DELETE_ROUTING_TEMPLATE', id, 'routing_templates', 'migration:20240101000017'
FROM public.routing_templates
WHERE id = '00000000-0000-0000-0000-000000000002'
   OR name IN ('Two-Step Lead & Admin Review', '2-Step Approval', '2-Step Approval ');

DELETE FROM public.routing_templates
WHERE id = '00000000-0000-0000-0000-000000000002'
   OR name IN ('Two-Step Lead & Admin Review', '2-Step Approval', '2-Step Approval ');
