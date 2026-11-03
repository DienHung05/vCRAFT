'use client';

import { type ReactNode, useRef } from 'react';
import { magneticOffset } from './motion-math';
import { useRichMotion } from './use-motion';

/**
 * Leans its child a few pixels towards the pointer (GH#95, "magnetic buttons"). Mouse and pen only, off
 * under reduced motion; only a transform changes, so nothing reflows.
 */
export function Magnetic({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLSpanElement>(null);
  const motion = useRichMotion({ finePointer: true });
  const reset = () => {
    if (ref.current) ref.current.style.transform = '';
  };
  return (
    <span
      ref={ref}
      className="inline-block transition-transform duration-(--duration-quick) ease-clay"
      onPointerMove={(event) => {
        if (!motion || event.pointerType === 'touch' || !ref.current) return;
        const { x, y } = magneticOffset(
          { x: event.clientX, y: event.clientY },
          ref.current.getBoundingClientRect(),
        );
        ref.current.style.transform = `translate(${x}px, ${y}px)`;
      }}
      onPointerLeave={reset}
    >
      {children}
    </span>
  );
}
