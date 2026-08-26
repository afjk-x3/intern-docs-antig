import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { z } from 'zod';
import { headers } from 'next/headers';

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const requirementSchema = z.object({
  name: z.string().min(2, 'Requirement name must be at least 2 characters'),
  description: z.string().optional().default(''),
  accepted_types: z.array(z.string()).min(1, 'Please select at least one accepted file type (PDF, PNG, or JPEG)'),
  max_size_mb: z.number().int().min(1, 'Minimum file size is 1 MB').max(50, 'Maximum file size is 50 MB').default(20),
  due_date_type: z.enum(['fixed', 'relative'], { message: 'Please select a valid due date type' }),
  due_date_value: z.string().min(1, 'Please provide a due date value'),
  routing_template_id: z.preprocess(
    (val) => (typeof val === 'string' && uuidRegex.test(val) ? val : null),
    z.string().uuid().nullable().optional()
  ),
});

export async function getRequirements() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('requirements')
    .select('*, routing_templates(*)')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load requirements: ${error.message}`);
  }
  return data || [];
}

export async function getRequirementById(id: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('requirements')
    .select('*, routing_templates(*)')
    .eq('id', id)
    .single();

  if (error) {
    throw new Error(`Failed to load requirement: ${error.message}`);
  }
  return data;
}

export async function createRequirement(input: z.infer<typeof requirementSchema>) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    throw new Error('Unauthorized: Only administrators can create requirements.');
  }

  const parsed = requirementSchema.parse(input);
  const adminClient = createAdminClient();

  const { data: newReq, error: insertError } = await adminClient
    .from('requirements')
    .insert({
      name: parsed.name,
      description: parsed.description,
      accepted_types: parsed.accepted_types,
      max_size_mb: parsed.max_size_mb,
      due_date_type: parsed.due_date_type,
      due_date_value: parsed.due_date_value,
      routing_template_id: parsed.routing_template_id || null,
      version_number: 1,
      signature_config: { page: 'last', x: 380, y: 80, width: 160, height: 60 },
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create requirement: ${insertError.message}`);
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'CREATE_REQUIREMENT',
    target_id: newReq.id,
    target_type: 'requirements',
    source_ip: ip,
  });

  return newReq;
}

export async function updateRequirement(id: string, input: Partial<z.infer<typeof requirementSchema>>) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!dbUser || !['admin', 'system_admin'].includes(dbUser.role)) {
    throw new Error('Unauthorized');
  }

  const adminClient = createAdminClient();

  // Fetch current version to increment
  const { data: currentReq, error: fetchErr } = await adminClient
    .from('requirements')
    .select('version_number')
    .eq('id', id)
    .single();

  if (fetchErr || !currentReq) {
    throw new Error('Requirement not found');
  }

  const newVersion = (currentReq.version_number || 1) + 1;

  const { data: updatedReq, error: updateError } = await adminClient
    .from('requirements')
    .update({
      ...input,
      version_number: newVersion,
    })
    .eq('id', id)
    .select()
    .single();

  if (updateError) {
    throw new Error(`Failed to update requirement: ${updateError.message}`);
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'UPDATE_REQUIREMENT',
    target_id: id,
    target_type: 'requirements',
    source_ip: ip,
  });

  return updatedReq;
}
