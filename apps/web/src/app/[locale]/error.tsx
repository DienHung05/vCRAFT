'use client';

import { RouteError } from '@/components/states/route-error';

/**
 * Last-resort error boundary of `[locale]`. It sits above the route-group layouts, so the shell is not
 * rendered here; the groups with a shell carry their own `error.tsx` instead. The "cannot check your
 * session" screen (`auth.serviceDown`) is only for guarded layouts, via `SessionUnavailable`.
 */
export default function LocaleError({ reset }: { error: Error; reset: () => void }) {
  return <RouteError reset={reset} />;
}
