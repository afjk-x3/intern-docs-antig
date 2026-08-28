'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

interface AutoRefreshProps {
  /** Polling interval in milliseconds. */
  intervalMs: number;
}

/**
 * Background auto-refresh for a Server Component page: periodically calls router.refresh()
 * to re-run this route's Server Components against the database. No client-side data
 * fetching or Supabase subscription of any kind -- the refreshed data still comes from the
 * server, through the same RLS-scoped queries the initial render used.
 *
 * Polling pauses while the tab is hidden (backgrounded/minimized) so an idle tab doesn't
 * keep polling the server; it resumes -- with an immediate refresh -- as soon as the tab
 * becomes visible again.
 */
export function AutoRefresh({ intervalMs }: AutoRefreshProps) {
  const router = useRouter();

  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => router.refresh(), intervalMs);
    };

    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        start();
      } else {
        stop();
      }
    };

    if (document.visibilityState === 'visible') start();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      stop();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [intervalMs, router]);

  return null;
}
