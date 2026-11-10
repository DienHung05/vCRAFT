'use client';

import { useCallback, useRef } from 'react';

/** Retains a submission's key after failure, until its request changes or succeeds. */
export function useIdempotentAction() {
  const pending = useRef<{ input: string; key: string } | null>(null);

  return useCallback(
    async <T>(
      input: unknown,
      send: (options: { idempotencyKey: string }) => Promise<T>,
    ): Promise<T> => {
      const serialized = JSON.stringify(input);
      if (!pending.current || pending.current.input !== serialized) {
        pending.current = { input: serialized, key: globalThis.crypto.randomUUID() };
      }
      const submission = pending.current;
      const result = await send({ idempotencyKey: submission.key });
      if (pending.current === submission) pending.current = null;
      return result;
    },
    [],
  );
}
