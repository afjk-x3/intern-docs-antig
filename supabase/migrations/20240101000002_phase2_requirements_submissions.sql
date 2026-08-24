-- 20240101000002_phase2_requirements_submissions.sql

-- 1. Extend submission_versions with return_comment
ALTER TABLE public.submission_versions 
ADD COLUMN IF NOT EXISTS return_comment TEXT;

-- 2. Extend requirements with version_number
ALTER TABLE public.requirements 
ADD COLUMN IF NOT EXISTS version_number INTEGER NOT NULL DEFAULT 1;

-- 3. Create private storage buckets for submissions and templates if not already present
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('submissions', 'submissions', false, 20971520, ARRAY['application/pdf', 'image/png', 'image/jpeg']),
  ('templates', 'templates', false, 10485760, ARRAY['application/pdf', 'image/png', 'image/jpeg'])
ON CONFLICT (id) DO UPDATE SET
  public = false,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- 4. Storage policies for private buckets
CREATE POLICY "Authenticated users can upload to submissions"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'submissions');

CREATE POLICY "Authenticated users can read submissions via signed URLs only"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'submissions');

-- 5. Seed default routing templates
INSERT INTO public.routing_templates (id, name, steps, sla_days)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'Single Supervisor Review', '[{"step": 1, "role": "approver", "name": "Supervisor Review"}]'::jsonb, 2),
  ('00000000-0000-0000-0000-000000000002', 'Two-Step Lead & Admin Review', '[{"step": 1, "role": "approver", "name": "Lead Review"}, {"step": 2, "role": "admin", "name": "Admin Final Review"}]'::jsonb, 3)
ON CONFLICT (id) DO NOTHING;

-- 6. Seed initial requirement definitions (FR-4)
INSERT INTO public.requirements (id, name, description, accepted_types, max_size_mb, due_date_type, due_date_value, routing_template_id, version_number)
VALUES
  (
    '11111111-1111-1111-1111-111111111111',
    'Evaluation Paper',a
    'Mid-term or final evaluation form completed by your school OJT coordinator or mentor.',
    ARRAY['application/pdf', 'image/png', 'image/jpeg'],
    20,
    'relative',
    '30', -- 30 days from internship start
    '00000000-0000-0000-0000-000000000001',
    1
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    'Daily Time Record (DTR)',
    'Monthly log of internship hours rendered at Makerspace requiring supervisor approval.',
    ARRAY['application/pdf', 'image/png', 'image/jpeg'],
    20,
    'relative',
    '15', -- 15 days from start of cycle
    '00000000-0000-0000-0000-000000000001',
    1
  )
ON CONFLICT (id) DO NOTHING;
