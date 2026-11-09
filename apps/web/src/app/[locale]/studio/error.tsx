'use client';

import { RouteError } from '@/components/states/route-error';

/** Keeps this group's shell visible around the generic error screen. */
export default function GroupError({ reset }: { error: Error; reset: () => void }) {
  return <RouteError reset={reset} />;
}
