'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Global refresh-on-focus: re-runs the current route's Server Components (router.refresh())
 * whenever the user returns to this browser tab. Listens to both `focus` (regaining
 * OS-level window focus) and `visibilitychange` (switching back to this tab within the same
 * browser window), since browsers don't reliably fire `focus` for the latter -- together
 * they cover "the user clicked back into the browser tab" in practice.
 *
 * Mounted once in the root layout so it applies to every page without each route needing to
 * opt in. No client-side database queries or Supabase subscriptions are involved -- this
 * only asks the server to re-render the current route's Server Components.
 */
export function RefreshOnFocus() {
  const router = useRouter();

  useEffect(() => {
    const refresh = () => router.refresh();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') refresh();
    };

    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [router]);

  return null;
}
