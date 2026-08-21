import 'server-only';
import { createClient } from '../supabase/server';
import { createAdminClient } from '../supabase/admin';
import { z } from 'zod';
import { headers } from 'next/headers';

const stepSchema = z.object({
  step: z.number().int().min(1).max(2),
  role: z.enum(['approver', 'admin', 'system_admin']).optional(),
  user_id: z.string().uuid().optional(),
  name: z.string().min(2),
});

const routingTemplateSchema = z.object({
  name: z.string().min(2, 'Template name must be at least 2 characters'),
  steps: z.array(stepSchema).min(1, 'At least 1 step required').max(2, 'Maximum 2 sequential steps allowed'),
  sla_days: z.number().int().min(1).max(30).default(2),
});

export async function getRoutingTemplates() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('routing_templates')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load routing templates: ${error.message}`);
  }
  return data || [];
}

export async function getApproversList() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('users')
    .select('id, email, role')
    .in('role', ['approver', 'admin', 'system_admin'])
    .order('email', { ascending: true });

  if (error) {
    throw new Error(`Failed to load approvers: ${error.message}`);
  }
  return data || [];
}

export async function createRoutingTemplate(input: z.infer<typeof routingTemplateSchema>) {
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

  const parsed = routingTemplateSchema.parse(input);
  const adminClient = createAdminClient();

  const { data: newTemplate, error: insertError } = await adminClient
    .from('routing_templates')
    .insert({
      name: parsed.name,
      steps: parsed.steps,
      sla_days: parsed.sla_days,
    })
    .select()
    .single();

  if (insertError) {
    throw new Error(`Failed to create routing template: ${insertError.message}`);
  }

  const reqHeaders = await headers();
  const ip = reqHeaders.get('x-forwarded-for') || 'unknown';

  await adminClient.from('audit_log').insert({
    actor_id: user.id,
    action: 'CREATE_ROUTING_TEMPLATE',
    target_id: newTemplate.id,
    target_type: 'routing_templates',
    source_ip: ip,
  });

  return newTemplate;
}
