import { getOnboardingContext, completeOnboarding } from '@lib/data/auth';
import { AcceptInviteForm, type OnboardingInput } from '@/components/AcceptInviteForm';

export default function AcceptInvitePage() {
  async function handleGetContext() {
    'use server';
    try {
      const context = await getOnboardingContext();
      return { role: context.role };
    } catch {
      // Not authenticated yet (token still being exchanged client-side) -- the form
      // treats this the same as "unknown role" and shows only the base fields.
      return { role: null };
    }
  }

  async function handleCompleteOnboarding(input: OnboardingInput) {
    'use server';
    try {
      const res = await completeOnboarding(input);
      return { success: true, role: res.role };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Failed to complete account setup.';
      return { error: msg };
    }
  }

  return (
    <AcceptInviteForm
      onGetContextAction={handleGetContext}
      onCompleteAction={handleCompleteOnboarding}
    />
  );
}
