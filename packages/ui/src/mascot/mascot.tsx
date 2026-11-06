'use client';

import { useEffect, useId, useRef, useState } from 'react';
import { useReducedMotion } from '../hooks/use-reduced-motion';
import { cn } from '../lib/cn';
import {
  BLINK_MS,
  canBlink,
  type EyeShape,
  gazeDirection,
  isDoubleBlink,
  type MascotMood,
  type MouthShape,
  mascotFace,
  nextBlinkDelay,
  THOUGHT_MS,
} from './mascot-model';

export interface MascotProps {
  mood?: MascotMood;
  /** Lines for the thought bubble; several cross-fade every 2.5 s. None hides the bubble. */
  thought?: string | readonly string[] | undefined;
  /** Where the head turns: the pointer, a point in viewport coordinates, or straight ahead. */
  lookAt?: 'pointer' | { x: number; y: number } | null;
  /** Rendered size in px: 56 (phone launcher), 64 (desktop launcher), 96 (panel header). */
  size?: number;
  /** Idle this long, the Fox dozes off (Zzz). */
  dozeAfterMs?: number;
  /** Accessible name; without it the mascot is decorative. */
  label?: string;
  /** Overrides `prefers-reduced-motion` (tests, previews). */
  reducedMotion?: boolean;
  className?: string;
}

const INK = 'var(--color-ink)';
const CLAY = 'var(--color-clay)';
const GLAZE = 'var(--color-glaze)';
// Cream of the muzzle, chest and tail tip: paper, so it follows the light/dark palette like the rest.
const CREAM = 'var(--color-paper)';

function Eye({ cx, shape, blinking }: { cx: number; shape: EyeShape; blinking: boolean }) {
  const cy = 46;
  if (blinking || shape === 'closed')
    return (
      <path
        d={`M${cx - 3.5} ${cy} q3.5 2.5 7 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    );
  if (shape === 'happy')
    return (
      <path
        d={`M${cx - 3.5} ${cy + 1} q3.5 -4 7 0`}
        fill="none"
        stroke={INK}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    );
  const r = shape === 'wide' ? 4.2 : 3.3;
  const dy = shape === 'up' ? -1.6 : 0;
  return (
    <g>
      <ellipse cx={cx} cy={cy + dy} rx={r} ry={r * 1.15} fill={INK} />
      <circle cx={cx + 1.1} cy={cy + dy - 1.3} r={1} fill={CREAM} />
    </g>
  );
}

function Mouth({ shape }: { shape: MouthShape }) {
  const stroke = { fill: 'none', stroke: INK, strokeWidth: 1.4, strokeLinecap: 'round' } as const;
  switch (shape) {
    case 'open':
      return <path d="M56 57.5 q4 6 8 0 z" fill={INK} />;
    case 'flat':
      return <path d="M56.5 58.5 h7" {...stroke} />;
    case 'o':
      return <circle cx={60} cy={59} r={1.8} fill={INK} />;
    case 'wobble':
      return <path d="M55 58.5 q2.5 -2 5 0 t5 0" {...stroke} />;
    default:
      return <path d="M55.5 57.5 q4.5 4 9 0" {...stroke} />;
  }
}

/** Nine-direction gaze toward the pointer or a fixed point, with the mascot's own box as the centre. */
function useGaze(
  ref: React.RefObject<SVGSVGElement | null>,
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
        setGaze(gazeDirection(centre(), { x: event.clientX, y: event.clientY })),
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

/** Random blinks every 3–6 s, sometimes double; none under reduced motion or with eyes closed. */
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
 * The Fox, vCraft's assistant mascot (BRAND §10): a chibi fox cub in fired-clay fur with a glaze-blue
 * scarf, holding a small garlic-neck vase, drawn with a thin ink outline and no 3D shading. Pure UI:
 * the widget decides the mood. It blinks at random, breathes 2 px on a 3 s cycle, turns its head toward
 * the pointer or a point with a slight lag, dozes off when left idle, and shows a thought bubble whose
 * three small clouds rise in turn before the line appears. Under `prefers-reduced-motion` it neither
 * blinks, breathes nor turns, and the bubble is static.
 */
export function Mascot({
  mood = 'idle',
  thought,
  lookAt = null,
  size = 64,
  dozeAfterMs = 90_000,
  label,
  reducedMotion,
  className,
}: MascotProps) {
  const systemReduced = useReducedMotion();
  const reduced = reducedMotion ?? systemReduced;
  const svg = useRef<SVGSVGElement>(null);
  const id = useId().replace(/:/g, '');
  const dozing = useDozing(mood === 'idle', dozeAfterMs);
  const shown: MascotMood = dozing ? 'sleep' : mood;
  const face = mascotFace(shown);
  const blinking = useBlink(!reduced && canBlink(shown));
  const gaze = useGaze(svg, lookAt, reduced || shown === 'sleep');
  const lines = thought === undefined ? [] : typeof thought === 'string' ? [thought] : [...thought];
  const bubble = useThought(lines, reduced);
  const motion = !reduced;

  const earTilt = face.ears === 'forward' ? -6 : face.ears === 'back' ? 10 : 0;
  return (
    <span
      className={cn('relative inline-block align-middle', className)}
      style={{ width: size, height: size }}
      data-mood={shown}
      data-motion={motion ? 'on' : 'off'}
    >
      <style>{`
        @keyframes vc-fox-${id}-breathe { 50% { transform: translateY(-2px); } }
        @keyframes vc-fox-${id}-wave { 50% { transform: rotate(-18deg); } }
        @keyframes vc-fox-${id}-shake { 25% { transform: rotate(-6deg); } 75% { transform: rotate(6deg); } }
        @keyframes vc-fox-${id}-rise { from { opacity: 0; transform: translateY(4px) scale(.6); } }
        @keyframes vc-fox-${id}-fade { from { opacity: 0; } }
      `}</style>
      <svg
        ref={svg}
        viewBox="0 0 120 120"
        width={size}
        height={size}
        role={label ? 'img' : undefined}
        aria-label={label}
        aria-hidden={label ? undefined : true}
        className="overflow-visible"
      >
        <g
          style={
            motion
              ? { animation: `vc-fox-${id}-breathe 3s var(--ease-clay, ease-in-out) infinite` }
              : undefined
          }
        >
          {/* Tail with a cream tip, like crackle glaze */}
          <path
            d="M84 96 C100 94 110 80 106 62 C104 74 96 82 82 86 Z"
            fill={CLAY}
            stroke={INK}
            strokeWidth={1.3}
            strokeLinejoin="round"
          />
          <path d="M106 62 C108 70 106 76 101 80 C104 72 104 67 106 62 Z" fill={CREAM} />
          {/* Body and chest */}
          <ellipse cx={60} cy={94} rx={25} ry={19} fill={CLAY} stroke={INK} strokeWidth={1.3} />
          <ellipse cx={60} cy={98} rx={14} ry={12} fill={CREAM} />
          {/* Glaze-blue scarf with a wave edge */}
          <path
            d="M37 72 Q60 82 83 72 L84 79 Q60 89 36 79 Z"
            fill={GLAZE}
            stroke={INK}
            strokeWidth={1.2}
          />
          <path
            d="M40 79 q3 2 6 0 t6 0 t6 0 t6 0 t6 0 t6 0 t6 0"
            fill="none"
            stroke={CREAM}
            strokeWidth={0.9}
            opacity={0.8}
          />
          <path d="M76 80 l6 14 l-7 -2 Z" fill={GLAZE} stroke={INK} strokeWidth={1.1} />
          {/* The small garlic-neck vase, held in both paws (hugged tight when refusing) */}
          <g transform={face.gesture === 'hug' ? 'translate(0 -2)' : undefined}>
            <path
              d="M56.5 82 h7 c0 3 -1 4 0 6 c6 3 8.5 7 8.5 11 c0 6 -5 9 -12 9 s-12 -3 -12 -9 c0 -4 2.5 -8 8.5 -11 c1 -2 0 -3 0 -6 z"
              fill={CREAM}
              stroke={INK}
              strokeWidth={1.2}
            />
            <path d="M51 99 q3 -2 6 0 t6 0 t6 0" fill="none" stroke={GLAZE} strokeWidth={1.4} />
            <ellipse
              cx={face.gesture === 'hug' ? 51 : 48}
              cy={99}
              rx={4.5}
              ry={4}
              fill={CLAY}
              stroke={INK}
              strokeWidth={1.1}
            />
            {face.gesture === 'wave' ? null : (
              <ellipse
                cx={face.gesture === 'hug' ? 69 : 72}
                cy={99}
                rx={4.5}
                ry={4}
                fill={CLAY}
                stroke={INK}
                strokeWidth={1.1}
              />
            )}
          </g>
          {face.gesture === 'wave' ? (
            <g
              style={{
                transformOrigin: '88px 74px',
                animation: motion
                  ? `vc-fox-${id}-wave 0.6s var(--ease-press, ease-out) 3`
                  : undefined,
              }}
            >
              <ellipse cx={97} cy={62} rx={4.5} ry={5} fill={CLAY} stroke={INK} strokeWidth={1.1} />
            </g>
          ) : null}
          {/* Head: turns one step toward the gaze, a little after it moves */}
          <g
            style={{
              transform: `translate(${gaze.x * 2.5}px, ${gaze.y * 1.5}px)`,
              transition: motion ? 'transform 240ms var(--ease-clay, ease-out) 60ms' : undefined,
              transformOrigin: '60px 50px',
              animation:
                motion && shown === 'refuse' ? `vc-fox-${id}-shake 0.5s ease-in-out 2` : undefined,
            }}
          >
            <g transform={`rotate(${-earTilt} 40 30)`}>
              <path
                d="M36 36 L30 10 L52 27 Z"
                fill={CLAY}
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <path d="M37 31 L34 16 L46 26 Z" fill={INK} opacity={0.75} />
            </g>
            <g transform={`rotate(${earTilt} 80 30)`}>
              <path
                d="M84 36 L90 10 L68 27 Z"
                fill={CLAY}
                stroke={INK}
                strokeWidth={1.3}
                strokeLinejoin="round"
              />
              <path d="M83 31 L86 16 L74 26 Z" fill={INK} opacity={0.75} />
            </g>
            <path
              d="M29 47 Q29 25 60 24 Q91 25 91 47 Q90 69 60 70 Q30 69 29 47 Z"
              fill={CLAY}
              stroke={INK}
              strokeWidth={1.3}
            />
            <path d="M40 58 Q60 74 80 58 Q76 66 60 67 Q44 66 40 58 Z" fill={CREAM} />
            <g transform={`translate(${gaze.x * 1.5} ${gaze.y * 1})`}>
              <Eye cx={48} shape={face.eyes} blinking={blinking} />
              <Eye cx={72} shape={face.eyes} blinking={blinking} />
              <ellipse cx={60} cy={53} rx={2.6} ry={2} fill={INK} />
              <Mouth shape={face.mouth} />
            </g>
          </g>
          {face.gesture === 'zzz' ? (
            <text x={88} y={26} fontSize={12} fontWeight={600} fill={INK} opacity={0.7}>
              z
              <tspan dx={1} dy={-6} fontSize={15}>
                Z
              </tspan>
            </text>
          ) : null}
          {face.gesture === 'question' ? (
            <text x={92} y={28} fontSize={18} fontWeight={700} fill={GLAZE}>
              ?
            </text>
          ) : null}
        </g>
      </svg>
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
    </span>
  );
}
