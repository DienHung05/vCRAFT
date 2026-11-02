'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';

/** The ember island is a separate chunk; it is only fetched once the conditions below hold. */
const KilnCanvas = dynamic(() => import('./kiln-canvas').then((module) => module.KilnCanvas), {
  ssr: false,
});

/** How long the browser may take to go idle before the island is mounted anyway. */
const IDLE_TIMEOUT_MS = 2000;

/** Hardware WebGL 2 or, failing that, WebGL 1. The probe context is released straight away. */
export function hasWebGL(): boolean {
  try {
    const probe = document.createElement('canvas');
    // `failIfMajorPerformanceCaveat`: a software renderer counts as no WebGL, so the static art stays.
    const options = { failIfMajorPerformanceCaveat: true };
    const gl = (probe.getContext('webgl2', options) ??
      probe.getContext('webgl', options)) as WebGLRenderingContext | null;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
    return gl != null;
  } catch {
    return false;
  }
}

/** Motion allowed, the tab visible and WebGL available. */
export function canMountEffects(): boolean {
  if (typeof window.matchMedia !== 'function') return false;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (document.visibilityState !== 'visible') return false;
  return hasWebGL();
}

/**
 * Loader of the WebGL ember island, mounted inside `.kiln-scene`. It mounts nothing on the server and
 * nothing at first paint: after the browser goes idle (or 2s), when every condition holds, it loads
 * the canvas chunk. Otherwise the static art stays. A hidden tab waits until it is shown; turning on reduced
 * motion unmounts the island again; a lost WebGL context unmounts it back to the static art.
 */
export function KilnEffects() {
  const [mounted, setMounted] = useState(false);
  const unmount = useCallback(() => setMounted(false), []);

  useEffect(() => {
    let idle: number | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    let settled = false;

    const attempt = () => {
      if (cancelled || settled) return;
      if (document.visibilityState !== 'visible') return; // retried by `onVisible`
      settled = true;
      if (canMountEffects()) setMounted(true);
    };
    const schedule = () => {
      if (typeof window.requestIdleCallback === 'function') {
        idle = window.requestIdleCallback(attempt, { timeout: IDLE_TIMEOUT_MS });
      } else {
        timer = setTimeout(attempt, 200);
      }
    };
    const onVisible = () => {
      if (document.visibilityState === 'visible' && !settled) schedule();
    };
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    const onMotion = () => {
      if (reduced?.matches) setMounted(false);
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    reduced?.addEventListener('change', onMotion);
    return () => {
      cancelled = true;
      if (idle !== undefined) window.cancelIdleCallback?.(idle);
      if (timer !== undefined) clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
      reduced?.removeEventListener('change', onMotion);
    };
  }, []);

  return mounted ? <KilnCanvas onUnavailable={unmount} /> : null;
}
