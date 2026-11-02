'use client';

import { useEffect, useRef } from 'react';
import { type KilnBurst, onKilnBurst } from './kiln-bus';
import { createEmberPass } from './kiln-embers';
import type { Frame, GL, KilnTheme } from './kiln-gl-util';
import { createGlowPass } from './kiln-glow';

/** DPR cap: the glow and the embers are soft, so a higher ratio only costs fill rate. */
const MAX_RATIO = 1.5;
/** The longest step the animation clock takes, so a stalled tab does not jump the embers. */
const MAX_STEP = 0.1;
/** How quickly the smoothed pointer follows the real one, per second. */
const POINTER_RATE = 6;

type Rgb = readonly [number, number, number];

/** Reads `#rrggbb`, `#rgb` or a space separated `r g b` triple into 0..1 channels. */
function parseColour(value: string): Rgb {
  const text = value.trim();
  const hex = text.match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i)?.[1];
  if (hex) {
    const full = hex.length === 3 ? [...hex].map((c) => c + c).join('') : hex;
    const n = Number.parseInt(full, 16);
    return [(n >> 16) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
  }
  const [r = 0, g = 0, b = 0] = text.split(/[\s,]+/).map(Number);
  return [r / 255, g / 255, b / 255];
}

/** The scene's colours come from its CSS custom properties (kiln.css), so both themes stay in one place. */
function readTheme(scene: Element): KilnTheme {
  const style = getComputedStyle(scene);
  const read = (name: string) => parseColour(style.getPropertyValue(name));
  const [r, g, b] = read('--color-paper');
  // Paper is #14110f in the dark theme and #f5efe4 in the light one.
  const dark = 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.4;
  const palette = new Float32Array(15);
  for (let slot = 0; slot < 5; slot++) palette.set(read(`--kiln-e${slot}`), slot * 3);
  return { dark, hot: read('--kiln-hot-rgb'), ember: read('--kiln-ember-rgb'), palette };
}

/**
 * The WebGL ember island: kiln glow, heat shimmer and rising embers over the static art. Mounted by
 * `KilnEffects` only after idle, with motion allowed and WebGL available. The canvas is created inside the
 * effect (so a dev or test remount gets a fresh one: a canvas whose context was lost cannot be reused), fades
 * in, then sets `data-kiln-gl="on"` on the scene so the static embers and shimmer give way.
 * `onUnavailable` is called when it cannot (or can no longer) draw, and the loader unmounts it.
 */
export function KilnCanvas({ onUnavailable }: { onUnavailable: () => void }) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    const scene = host?.closest<HTMLElement>('.kiln-scene');
    if (!host || !scene) return;

    const canvas = document.createElement('canvas');
    canvas.className = 'kiln-gl';
    canvas.setAttribute('aria-hidden', 'true');
    host.append(canvas);

    // A software renderer would only make the page slower than the static art: refuse it.
    const options: WebGLContextAttributes = {
      alpha: true,
      premultipliedAlpha: true,
      antialias: false,
      depth: false,
      stencil: false,
      powerPreference: 'low-power',
      failIfMajorPerformanceCaveat: true,
    };
    const gl: GL | null =
      canvas.getContext('webgl2', options) ?? canvas.getContext('webgl', options);
    const glow = gl ? createGlowPass(gl) : null;
    const embers = gl ? createEmberPass(gl) : null;
    if (!gl || !glow || !embers) {
      glow?.dispose();
      embers?.dispose();
      canvas.remove();
      onUnavailable();
      return;
    }

    const frame: Frame = {
      time: 0,
      width: 0,
      height: 0,
      pixelWidth: 1,
      pixelHeight: 1,
      ratio: 1,
      pointer: [0, 0],
      theme: readTheme(scene),
    };
    const target: [number, number] = [0, 0];
    let last = 0;
    let raf = 0;
    let shown = false;
    let inView = true;

    const resize = () => {
      frame.width = canvas.clientWidth;
      frame.height = canvas.clientHeight;
      frame.ratio = Math.min(window.devicePixelRatio || 1, MAX_RATIO);
      frame.pixelWidth = Math.max(1, Math.round(frame.width * frame.ratio));
      frame.pixelHeight = Math.max(1, Math.round(frame.height * frame.ratio));
      canvas.width = frame.pixelWidth;
      canvas.height = frame.pixelHeight;
    };

    const render = (now: number) => {
      raf = requestAnimationFrame(render);
      // The first step is clamped from below too: `now` can precede the time `last` was taken.
      const step = Math.max(0, Math.min((now - last) / 1000, MAX_STEP));
      last = now;
      frame.time += step;
      // Time-based easing, so the follow speed does not depend on the frame rate.
      const follow = 1 - Math.exp(-step * POINTER_RATE);
      frame.pointer[0] += (target[0] - frame.pointer[0]) * follow;
      frame.pointer[1] += (target[1] - frame.pointer[1]) * follow;
      gl.viewport(0, 0, frame.pixelWidth, frame.pixelHeight);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      glow.draw(frame);
      embers.draw(frame);
      if (!shown) {
        // First frame is on the canvas: fade it in and let the static layers give way.
        shown = true;
        canvas.dataset.on = 'true';
        scene.dataset.kilnGl = 'on';
      }
    };

    // Draw only while the tab is visible and the scene is on screen.
    const sync = () => {
      const run = inView && document.visibilityState === 'visible';
      if (run && raf === 0) {
        last = performance.now();
        raf = requestAnimationFrame(render);
      } else if (!run && raf !== 0) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const intersection = new IntersectionObserver((entries) => {
      inView = entries.some((entry) => entry.isIntersecting);
      sync();
    });
    const resizing = new ResizeObserver(resize);
    const colourScheme = window.matchMedia('(prefers-color-scheme: dark)');
    const refreshTheme = () => {
      frame.theme = readTheme(scene);
    };
    const themeAttribute = new MutationObserver(refreshTheme);
    themeAttribute.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    });
    colourScheme.addEventListener('change', refreshTheme);

    // Subtle parallax, only for a fine pointer.
    const finePointer = window.matchMedia('(pointer: fine)').matches;
    const onPointer = (event: PointerEvent) => {
      target[0] = (event.clientX / window.innerWidth) * 2 - 1;
      target[1] = 1 - (event.clientY / window.innerHeight) * 2;
    };
    if (finePointer) window.addEventListener('pointermove', onPointer, { passive: true });

    // Embers stream from the submit button to the seal (kiln-bus.ts); coordinates become canvas pixels.
    const stopBurst = onKilnBurst(({ from, to, quick = false }: KilnBurst) => {
      if (raf === 0) return;
      const box = canvas.getBoundingClientRect();
      embers.burst(
        {
          fromX: from.left + from.width / 2 - box.left,
          fromY: from.top + from.height / 2 - box.top,
          toX: to.left + to.width / 2 - box.left,
          toY: to.top + to.height / 2 - box.top,
          reach: Math.min(to.width, to.height) * 0.5,
          quick,
        },
        frame.time,
      );
    });

    const onLost = (event: Event) => {
      event.preventDefault();
      onUnavailable();
    };
    canvas.addEventListener('webglcontextlost', onLost);
    document.addEventListener('visibilitychange', sync);
    resize();
    resizing.observe(canvas);
    intersection.observe(scene);
    sync();

    return () => {
      cancelAnimationFrame(raf);
      raf = 0;
      intersection.disconnect();
      resizing.disconnect();
      themeAttribute.disconnect();
      colourScheme.removeEventListener('change', refreshTheme);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', sync);
      canvas.removeEventListener('webglcontextlost', onLost);
      stopBurst();
      delete scene.dataset.kilnGl;
      glow.dispose();
      embers.dispose();
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      canvas.remove();
    };
  }, [onUnavailable]);

  return <div ref={hostRef} aria-hidden="true" className="kiln-gl-host" />;
}
