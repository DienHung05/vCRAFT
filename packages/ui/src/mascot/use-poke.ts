'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { NO_POKES, registerPoke, type SpriteReaction } from './mascot-model';

/**
 * Click reactions for a mascot (GH#211): call `poke()` on every click or tap and pass `reaction` to
 * `<Mascot reaction>`. A single poke shows a short surprised look; about four quick pokes make it dizzy for
 * a moment. Purely cosmetic: it never handles or swallows the click itself, so the caller's own action
 * (opening a panel) still runs.
 */
export function useMascotPoke(): { reaction: SpriteReaction | null; poke: () => void } {
  const [reaction, setReaction] = useState<SpriteReaction | null>(null);
  const state = useRef(NO_POKES);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const poke = useCallback(() => {
    const next = registerPoke(state.current, Date.now());
    state.current = next.state;
    setReaction(next.reaction);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setReaction(null), next.holdMs);
  }, []);
  return { reaction, poke };
}
