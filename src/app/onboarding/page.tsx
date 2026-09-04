import { redirect } from 'next/navigation';

export default function OnboardingPage() {
  // Onboarding is bypassed in favor of upfront self-registration; redirect directly to /
  redirect('/');
}

