'use client';

import type { CSSProperties } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';
import {
  BLINK_MS,
  canBlink,
  directionIndex,
  gazeDirection,
  gazeToDirection,
  isDoubleBlink,
  type MascotMood,
  moodFixedDirection,
  moodReaction,
  nextBlinkDelay,
  reactionIndex,
  type SpriteReaction,
  THOUGHT_MS,
} from './mascot-model';

export interface MascotProps {
  mood?: MascotMood;
  /**
   * A short reaction shown over the mood, such as the dizzy face after rapid clicks (`useMascotPoke`,
   * GH#211). `dizzy` also wobbles the head while motion is allowed.
   */
  reaction?: SpriteReaction | null;
  /** Lines for the thought bubble; several cross-fade every 2.5 s. None hides the bubble. */
  thought?: string | readonly string[] | undefined;
  /** Where the head turns: the pointer, a point in viewport coordinates, or straight ahead. */
  lookAt?: 'pointer' | { x: number; y: number } | null;
  /** Rendered size in px: 56 (phone launcher), 64 (desktop launcher), 96 (panel header). */
  size?: number;
  /** Idle this long, the Fox dozes off (sleepy). */
  dozeAfterMs?: number;
  /** Accessible name; without it the mascot is decorative. */
  label?: string;
  /** Overrides `prefers-reduced-motion` (tests, previews). */
  reducedMotion?: boolean;
  className?: string;
  /** URL for the 3×3 directions sprite sheet. Defaults to '/mascots/fox-directions.webp'. */
  directions?: string;
  /** URL for the 3×3 reactions sprite sheet. Defaults to '/mascots/fox-reactions.webp'. */
  reactions?: string;
  /**
   * URL for the 3×3 closed-eye directions sheet, aligned cell for cell with `directions`.
   * Defaults to '/mascots/fox-directions-blink.webp'.
   */
  blinks?: string;
}

// background-size 300% 300% makes each 1/3 cell a clean 0/50/100% step on both axes.
function cellStyle(index: number): CSSProperties {
  const col = index % 3;
  const row = Math.floor(index / 3);
  return { backgroundPosition: `${col * 50}% ${row * 50}%` };
}

const LAYER_BASE: CSSProperties = {
  position: 'absolute',
  inset: 0,
  backgroundSize: '300% 300%',
  backgroundRepeat: 'no-repeat',
};

/** Nine-direction gaze toward the pointer or a fixed point, with the mascot's own box as the centre. */
function useGaze(
  ref: React.RefObject<HTMLDivElement | null>,
  lookAt: MascotProps['lookAt'],
  off: boolean,
) {
  const [gaze, setGaze] = useState<{ x: -1 | 0 | 1; y: -1 | 0 | 1 }>({ x: 0, y: 0 });
  useEffect(() => {
    if (off || !lookAt) {
      setGaze({ x: 0, y: 0 });
      return;
    }
    const centre = () => {
      const box = ref.current?.getBoundingClientRect();
      return box ? { x: box.left + box.width / 2, y: box.top + box.height / 2 } : { x: 0, y: 0 };
    };
    if (lookAt !== 'pointer') {
      setGaze(gazeDirection(centre(), lookAt));
      return;
    }
    let frame = 0;
    const onMove = (event: PointerEvent) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() =>
        setGaze((current) => {
          const next = gazeDirection(centre(), { x: event.clientX, y: event.clientY });
          return next.x === current.x && next.y === current.y ? current : next;
        }),
      );
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('pointermove', onMove);
    };
  }, [lookAt, off, ref]);
  return gaze;
}

/** Random blinks every 3–6 s, sometimes double; none under reduced motion. */
function useBlink(enabled: boolean) {
  const [blinking, setBlinking] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const blinkOnce = (after: number) =>
      timers.push(
        setTimeout(() => {
          setBlinking(true);
          timers.push(setTimeout(() => setBlinking(false), BLINK_MS));
        }, after),
      );
    const schedule = () => {
      const delay = nextBlinkDelay();
      blinkOnce(delay);
      if (isDoubleBlink()) blinkOnce(delay + BLINK_MS * 2.5);
      timers.push(setTimeout(schedule, delay + BLINK_MS * 4));
    };
    schedule();
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [enabled]);
  return enabled && blinking;
}

/** `true` once nothing has happened for `after` ms; any pointer or key activity wakes it. */
function useDozing(active: boolean, after: number) {
  const [dozing, setDozing] = useState(false);
  useEffect(() => {
    if (!active) {
      setDozing(false);
      return;
    }
    let timer = setTimeout(() => setDozing(true), after);
    const wake = () => {
      setDozing(false);
      clearTimeout(timer);
      timer = setTimeout(() => setDozing(true), after);
    };
    window.addEventListener('pointermove', wake, { passive: true });
    window.addEventListener('keydown', wake);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('pointermove', wake);
      window.removeEventListener('keydown', wake);
    };
  }, [active, after]);
  return dozing;
}

/** Rotating thought lines, one every 2.5 s; under reduced motion the line changes without a fade. */
function useThought(lines: readonly string[], reduced: boolean) {
  const [index, setIndex] = useState(0);
  const key = JSON.stringify(lines);
  const count = lines.length;
  // biome-ignore lint/correctness/useExhaustiveDependencies: restart when the lines change, not their array identity.
  useEffect(() => {
    setIndex(0);
    if (count < 2) return;
    const timer = setInterval(() => setIndex((i) => (i + 1) % count), THOUGHT_MS);
    return () => clearInterval(timer);
  }, [key, count]);
  return { line: lines[index] ?? '', index, animate: !reduced };
}

/**
 * The Fox, vCraft's assistant mascot (BRAND §10): uses the original page-mascot fox sprite sheets
 * (fox-directions.webp and fox-reactions.webp) unchanged, plus fox-directions-blink.webp (the same nine
 * gaze cells with the eyes closed), rendered via three stacked CSS background layers. A blink swaps the
 * gaze cell for its closed-eye twin, so the head keeps facing where it looks (GH#186).
 *
 * The component blinks at random, breathes 2 px on a 3 s cycle, turns its head toward the pointer or a
 * point, dozes off when left idle, and shows a thought bubble whose three small clouds rise in turn before
 * the line appears. Under `prefers-reduced-motion` it neither blinks nor breathes and the bubble is
 * static; it still turns its head, since that is an instant swap of sprite cells with no movement
 * (GH#203).
 */
export function Mascot({
  mood = 'idle',
  reaction = null,
  thought,
  lookAt = null,
  size = 64,
  dozeAfterMs = 90_000,
  label,
  reducedMotion,
  className,
  directions = '/mascots/fox-directions.webp',
  reactions = '/mascots/fox-reactions.webp',
  blinks = '/mascots/fox-directions-blink.webp',
}: MascotProps) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const id = useId().replace(/:/g, '');
  const dozing = useDozing(mood === 'idle', dozeAfterMs);
  const shown: MascotMood = dozing ? 'sleep' : mood;

  // A head turn is an instant swap of sprite cells, not movement, so it stays on under reduced motion
  // (GH#203).
  const gaze = useGaze(wrapperRef, lookAt, shown === 'sleep' || shown === 'refuse');
  const blinking = useBlink(!reduced && canBlink(shown));
  const lines = thought === undefined ? [] : typeof thought === 'string' ? [thought] : [...thought];
  const bubble = useThought(lines, reduced);
  const motion = !reduced;

  // Reactions layer: only for reaction-based moods. Blinking never touches it (GH#186).
  const reactionMood = reaction ?? moodReaction(shown);
  const showReaction = reactionMood !== null;
  // Blink layer: the closed-eye twin of the current gaze cell, shown instantly while blinking.
  const showBlink = blinking && !showReaction;

  // Directions layer: use a fixed direction for think/refuse, otherwise gaze-driven.
  const fixedDir = moodFixedDirection(shown);
  const currentDirection = fixedDir ?? gazeToDirection(gaze);
  const dirIdx = directionIndex(currentDirection);

  const reactIdx = reactionIndex(reactionMood ?? 'blink');

  return (
    <div
      ref={wrapperRef}
      className={cn('relative inline-block align-middle', className)}
      style={{ width: size, height: size }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
      data-mood={shown}
      data-reaction={reaction ?? undefined}
      data-motion={motion ? 'on' : 'off'}
    >
      <style>{`
        @keyframes vc-fox-${id}-breathe { 50% { transform: translateY(-2px); } }
        @keyframes vc-fox-${id}-shake { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        @keyframes vc-fox-${id}-wobble { 20% { transform: rotate(-10deg); } 40% { transform: rotate(8deg); } 60% { transform: rotate(-6deg); } 80% { transform: rotate(4deg); } }
        @keyframes vc-fox-${id}-rise { from { opacity: 0; transform: translateY(4px) scale(.6); } }
        @keyframes vc-fox-${id}-fade { from { opacity: 0; } }
      `}</style>

      {/* Breathing wrapper */}
      <span
        style={{
          position: 'relative',
          display: 'block',
          width: '100%',
          height: '100%',
          animation: motion
            ? `vc-fox-${id}-breathe 3s var(--ease-clay, ease-in-out) infinite`
            : undefined,
          // Head shake for 'refuse' mood
          ...(motion && shown === 'refuse'
            ? { animation: `vc-fox-${id}-shake 0.5s ease-in-out 2` }
            : {}),
          // Dizzy after rapid pokes: the head wobbles twice (GH#211); a frame swap only under reduced motion.
          ...(motion && reaction === 'dizzy'
            ? { animation: `vc-fox-${id}-wobble 0.9s ease-in-out 2` }
            : {}),
        }}
      >
        {/* Directions layer — always mounted so the sheet is preloaded; hidden when reaction is active */}
        <span
          data-layer="directions"
          style={{
            ...LAYER_BASE,
            backgroundImage: `url(${directions})`,
            ...cellStyle(dirIdx),
            opacity: showReaction ? 0 : 1,
            transition: motion ? 'opacity 60ms' : undefined,
          }}
        />
        {/* Blink layer — always mounted so the sheet is preloaded; same cell as the directions layer.
            No transition: a blink is an instant swap, never a cross-fade between two poses. */}
        <span
          data-layer="blink"
          style={{
            ...LAYER_BASE,
            backgroundImage: `url(${blinks})`,
            ...cellStyle(dirIdx),
            opacity: showBlink ? 1 : 0,
          }}
        />
        {/* Reactions layer — always mounted so the sheet is preloaded; shown for mood reactions */}
        <span
          data-layer="reactions"
          style={{
            ...LAYER_BASE,
            backgroundImage: `url(${reactions})`,
            ...cellStyle(reactIdx),
            opacity: showReaction ? 1 : 0,
            transition: motion ? 'opacity 60ms' : undefined,
          }}
        />
      </span>

      {bubble.line ? (
        <span aria-hidden="true" className="pointer-events-none absolute bottom-[78%] left-[62%]">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="absolute rounded-full border border-ink/60 bg-paper"
              style={{
                width: 4 + i * 2,
                height: 4 + i * 2,
                left: i * 6,
                bottom: i * 6,
                animation: bubble.animate
                  ? `vc-fox-${id}-rise 240ms var(--ease-clay, ease-out) ${i * 120}ms both`
                  : undefined,
              }}
            />
          ))}
          <span
            className="absolute bottom-5 left-4 block w-max max-w-[15rem] border border-ink/70 bg-paper px-3 py-1.5 text-small text-ink shadow-warm"
            // Uneven corners, like a hand-cut seal (BRAND §10).
            style={{
              borderRadius: '14px 10px 16px 9px',
              animation: bubble.animate
                ? `vc-fox-${id}-rise 240ms var(--ease-clay, ease-out) 360ms both`
                : undefined,
            }}
          >
            <span
              key={bubble.index}
              className="block"
              style={
                bubble.animate ? { animation: `vc-fox-${id}-fade 320ms ease-out both` } : undefined
              }
            >
              {bubble.line}
            </span>
          </span>
        </span>
      ) : null}
    </div>
  );
}
