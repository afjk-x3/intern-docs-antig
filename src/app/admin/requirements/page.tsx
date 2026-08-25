import { getRequirements, createRequirement } from '@lib/data/requirements';
import { getRoutingTemplates } from '@lib/data/routing';
import { AdminRequirementManager, CreateRequirementInput } from '@/components/AdminRequirementManager';

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
      if (e && typeof e === 'object' && 'issues' in e && Array.isArray((e as { issues: Array<{ message: string }> }).issues)) {
        return { error: (e as { issues: Array<{ message: string }> }).issues[0]?.message || 'Please check the requirement form details.' };
      }
      const msg = e instanceof Error ? e.message : 'Failed to create requirement';
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
      />
    </div>
  );
}
