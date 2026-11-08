'use client';

import { type SlugAvailabilityDto, SlugSchema } from '@vcraft/contracts';
import { useEffect, useState } from 'react';

export const SLUG_CHECK_DELAY_MS = 300;

export type SlugCheckState =
  | { status: 'idle' }
  | { status: 'checking' }
  | { status: 'available' }
  | { status: 'taken'; suggestion?: string }
  | { status: 'unavailable' };

/**
 * Live duplicate check of a household page address (FR-ART-01). The request goes out 300 ms after the last
 * keystroke; an answer for an earlier value is dropped. Nothing is asked for an empty or badly formed
 * address, or when `enabled` is false (the household's own, unchanged address).
 */
export function useSlugAvailability(
  slug: string,
  check: (slug: string) => Promise<SlugAvailabilityDto>,
  enabled = true,
): SlugCheckState {
  const [state, setState] = useState<SlugCheckState>({ status: 'idle' });
  // `check` is usually a fresh closure each render; only the typed value should restart the timer.
  // biome-ignore lint/correctness/useExhaustiveDependencies: see above.
  useEffect(() => {
    if (!enabled || !SlugSchema.safeParse(slug).success) {
      setState({ status: 'idle' });
      return;
    }
    let current = true;
    setState({ status: 'checking' });
    const timer = setTimeout(() => {
      Promise.resolve()
        .then(() => check(slug))
        .then(
          (answer) => {
            if (!current) return;
            setState(
              answer.available
                ? { status: 'available' }
                : {
                    status: 'taken',
                    ...(answer.suggestion ? { suggestion: answer.suggestion } : {}),
                  },
            );
          },
          () => current && setState({ status: 'unavailable' }),
        );
    }, SLUG_CHECK_DELAY_MS);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [slug, enabled]);
  return state;
}
