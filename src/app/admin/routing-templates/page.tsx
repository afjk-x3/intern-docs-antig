import { getRoutingTemplates, createRoutingTemplate } from '@lib/data/routing';
import { AdminRoutingTemplateManager } from '@/components/AdminRoutingTemplateManager';
import type { CreateRoutingTemplateInput } from '@/components/AdminRequirementManager';

export default async function RoutingTemplatesPage() {
  const routingTemplates = await getRoutingTemplates();

  async function handleCreateTpl(data: CreateRoutingTemplateInput) {
    'use server';
    try {
      await createRoutingTemplate(data);
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create template';
      return { error: msg };
    }
  }

  return (
    <div className="p-6 md:p-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Routing Templates</h1>
        <p className="text-sm text-text-muted mt-1">Configure multi-step approval workflows and SLA deadlines.</p>
      </div>
      
      <AdminRoutingTemplateManager
        routingTemplates={routingTemplates}
        onCreateTemplate={handleCreateTpl}
      />
    </div>
  );
}
