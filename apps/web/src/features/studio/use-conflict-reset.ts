import { useEffect, useRef } from 'react';

/**
 * Resets a section's drafts to the server values, but only after a stale-version (409) conflict
 * whose reload actually changed `version`. Call `arm()` when the conflict happens, before reloading.
 * Ordinary refreshes and saves of other sections never touch the drafts.
 */
export function useConflictReset(version: number, reset: () => void) {
  const armed = useRef(false);
  const latest = useRef(reset);
  latest.current = reset;
  // biome-ignore lint/correctness/useExhaustiveDependencies: `version` is the trigger.
  useEffect(() => {
    if (!armed.current) return;
    armed.current = false;
    latest.current();
  }, [version]);
  return {
    arm: () => {
      armed.current = true;
    },
    disarm: () => {
      armed.current = false;
    },
  };
}
