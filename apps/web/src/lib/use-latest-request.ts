import { useCallback, useEffect, useMemo, useRef } from 'react';

/**
 * Sequence counter for "only the newest request may write state". `begin()` starts a new request and
 * supersedes every earlier one; `isCurrent(id)` tells a finished request whether it is still wanted.
 * Unmounting supersedes everything, so a late response never touches an unmounted screen.
 * `peek()` returns the current id without superseding it (a "load more" belongs to the list it extends).
 */
export function useLatestRequest() {
  const sequence = useRef(0);
  useEffect(() => {
    return () => {
      sequence.current += 1;
    };
  }, []);
  const begin = useCallback(() => ++sequence.current, []);
  const peek = useCallback(() => sequence.current, []);
  const isCurrent = useCallback((id: number) => id === sequence.current, []);
  // A stable object: callers list it in hook dependencies without re-running their effects.
  return useMemo(() => ({ begin, peek, isCurrent }), [begin, peek, isCurrent]);
}
