'use client';

import { type RefObject, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

interface ThoughtProps {
  anchor: RefObject<HTMLDivElement | null>;
  portal: boolean;
  line: string;
  index: number;
  animate: boolean;
  id: string;
}

/** A decorative thought can escape a clipped panel while following its moving mascot. */
export function MascotThought({ anchor, portal, line, index, animate, id }: ThoughtProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const [mounted, setMounted] = useState(false);
  const [position, setPosition] = useState<{
    left: number;
    top: number;
    below: boolean;
    cloudLeft: number;
  } | null>(null);

  useLayoutEffect(() => setMounted(true), []);
  useLayoutEffect(() => {
    if (!portal || !mounted) return;
    let frame = 0;
    const update = () => {
      const source = anchor.current;
      const thought = ref.current;
      if (source && thought) {
        const box = source.getBoundingClientRect();
        const viewport = window.visualViewport;
        const minX = (viewport?.offsetLeft ?? 0) + 8;
        const minY = (viewport?.offsetTop ?? 0) + 8;
        const maxX = minX + (viewport?.width ?? window.innerWidth) - 16;
        const maxY = minY + (viewport?.height ?? window.innerHeight) - 16;
        const width = thought.offsetWidth;
        const height = thought.offsetHeight;
        const x = box.left + box.width * 0.62;
        const y = box.top + box.height * 0.22;
        const below = y - height < minY;
        const left = Math.max(minX, Math.min(x, maxX - width));
        const top = Math.max(minY, Math.min(below ? y : y - height, maxY - height));
        const next = {
          left: Math.round(left),
          top: Math.round(top),
          below,
          cloudLeft: Math.round(Math.max(0, Math.min(x - left, width - 24))),
        };
        setPosition((current) =>
          current &&
          current.left === next.left &&
          current.top === next.top &&
          current.below === next.below &&
          current.cloudLeft === next.cloudLeft
            ? current
            : next,
        );
      }
      // Drawer transforms and map layout changes do not trigger ResizeObserver or scroll events.
      // Track only while a thought is mounted; cancel as soon as the answer starts streaming.
      frame = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frame);
  }, [anchor, portal, mounted]);

  const below = portal && position?.below;
  const thought = (
    <span
      ref={ref}
      aria-hidden="true"
      data-mascot-thought=""
      className={
        portal
          ? 'pointer-events-none fixed z-[100] block w-max max-w-[calc(100vw-1rem)]'
          : 'pointer-events-none absolute bottom-[78%] left-[62%] block w-max max-w-[15rem]'
      }
      style={
        portal
          ? {
              left: position?.left ?? 0,
              top: position?.top ?? 0,
              visibility: position ? 'visible' : 'hidden',
              pointerEvents: 'none',
            }
          : undefined
      }
    >
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="absolute rounded-full border border-ink/60 bg-paper"
          style={{
            width: 4 + i * 2,
            height: 4 + i * 2,
            left: (portal ? (position?.cloudLeft ?? 0) : 0) + i * 6,
            ...(below ? { top: i * 6 } : { bottom: i * 6 }),
            animation: animate
              ? `vc-fox-${id}-rise 240ms var(--ease-clay, ease-out) ${i * 120}ms both`
              : undefined,
          }}
        />
      ))}
      <span
        className="relative ml-4 block max-w-[15rem] border border-ink/70 bg-paper px-3 py-1.5 text-small text-ink shadow-warm"
        style={{
          ...(below ? { marginTop: 20 } : { marginBottom: 20 }),
          borderRadius: '14px 10px 16px 9px',
          animation: animate
            ? `vc-fox-${id}-rise 240ms var(--ease-clay, ease-out) 360ms both`
            : undefined,
        }}
      >
        <span
          key={index}
          className="block"
          style={animate ? { animation: `vc-fox-${id}-fade 320ms ease-out both` } : undefined}
        >
          {line}
        </span>
      </span>
    </span>
  );
  return portal ? (mounted ? createPortal(thought, document.body) : null) : thought;
}
