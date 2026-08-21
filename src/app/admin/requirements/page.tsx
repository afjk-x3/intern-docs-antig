import { getRequirements, createRequirement } from '@lib/data/requirements';
import { getRoutingTemplates, createRoutingTemplate } from '@lib/data/routing';
import { AdminRequirementManager, CreateRequirementInput, CreateRoutingTemplateInput } from '@/components/AdminRequirementManager';

export default async function RequirementsPage() {
  const [requirements, routingTemplates] = await Promise.all([
    getRequirements(),
    getRoutingTemplates(),
  ]);

  async function handleCreateReq(data: CreateRequirementInput) {
    'use server';
    try {
      await createRequirement({
        ...data,
        description: data.description || '',
      });
      return { success: true };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to create requirement';
      return { error: msg };
    }
  }

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
        <h1 className="text-2xl font-bold text-text-primary">Requirements</h1>
        <p className="text-sm text-text-muted mt-1">Manage submission requirements and their routing templates.</p>
      </div>
      
      <AdminRequirementManager
        requirements={requirements}
        routingTemplates={routingTemplates}
        onCreateRequirement={handleCreateReq}
        onCreateTemplate={handleCreateTpl}
      />
    </div>
  );
}
