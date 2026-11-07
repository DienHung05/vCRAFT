'use client';

import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';
import { durMs } from '../motion/tokens';
import { SealMark, type SealMarkProps } from './seal-mark';

export type StampTempo = 'moment' | 'tool';

export interface SealStampProps extends Pick<SealMarkProps, 'size' | 'title' | 'className'> {
  /**
   * `moment` (public pages, 520 ms) or `tool` (Studio and Admin, 280 ms: BRAND §6.4 keeps working tools
   * at or under 280 ms).
   */
  tempo?: StampTempo;
}

/**
 * "Đóng ấn" (BRAND §6.3 #2): the red seal presses down (scale 1.4 → 1, `ease.press`), the ink spreads
 * into the paper (animated SVG turbulence) and a wash of ink soaks out under it. Pair it with
 * `stampShakeClass(tempo)` on the surrounding frame for the slight shake as it lands. Only transforms,
 * opacity and an SVG filter move, so nothing around it shifts. Under reduced motion it is a 150 ms fade.
 *
 * Mount it when the moment happens (approval, accepted price, verified trace, published product):
 * it plays once on mount.
 */
export function SealStamp({ size = 64, title, tempo = 'moment', className }: SealStampProps) {
  const reduced = useReducedMotion();
  const ms = tempo === 'tool' ? durMs.base : durMs.slow;
  return (
    <span
      data-tempo={tempo}
      className={cn('seal-stamp relative inline-grid shrink-0 place-items-center', className)}
      style={{ width: size, height: size }}
    >
      {reduced ? null : <span aria-hidden="true" className="seal-stamp-wash" />}
      <SealMark
        size={size}
        {...(title ? { title } : {})}
        className="animate-stamp"
        {...(reduced ? {} : { spreadMs: ms })}
      />
    </span>
  );
}

/** Class for the frame around a `SealStamp`: a slight shake as the seal lands. None under reduced motion. */
export function stampShakeClass(tempo: StampTempo = 'moment'): string {
  return tempo === 'tool' ? 'animate-stamp-shake-quick' : 'animate-stamp-shake';
}
