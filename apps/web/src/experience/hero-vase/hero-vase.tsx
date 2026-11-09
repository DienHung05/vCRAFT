'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { canRun3d, readDeviceFacts } from './capability';
import { scrollProgress } from './vase-profiles';

// three.js and R3F load only here, after the decision below, never in the route's first-load JS.
const VaseScene = dynamic(() => import('./vase-scene'), { ssr: false });

/** Starts downloading the 3D chunk without waiting for the canvas to mount. */
const loadScene = () => import('./vase-scene');

/**
 * The 3D glaze vase that forms and turns in the home hero (GH#94, PLAN E13). The page renders the
 * server-side `TurningVase` underneath (GH#316): it is the first paint and the fallback for phones,
 * low-end devices, no WebGL, reduced motion and data saver, where nothing here loads. Otherwise the
 * scene chunk is prefetched on idle right after hydration, and the canvas fades in over the turning
 * vase only after it has drawn its first frame, inside the same box, so nothing shifts or flashes.
 * `sectionId` is the hero section whose scroll drives the morph.
 */
export function HeroVase({ sectionId }: { sectionId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const progress = useRef(0);
  const onReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!canRun3d(readDeviceFacts())) return;
    const start = () => {
      void loadScene();
      setEnabled(true);
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(start, { timeout: 1500 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(start, 200);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const section = document.getElementById(sectionId);
    if (!section) return;
    const update = () => {
      const box = section.getBoundingClientRect();
      // Finish the story while most of the hero is still on screen.
      progress.current = Math.min(1, scrollProgress(box.top, box.height) * 1.6);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [enabled, sectionId]);

  if (!enabled) return null;
  return (
    <div
      className={`pointer-events-none absolute inset-0 rounded-card bg-paper transition-opacity duration-700 ${ready ? 'opacity-100' : 'opacity-0'}`}
      data-testid="hero-vase-3d"
    >
      <VaseScene progress={progress} onReady={onReady} />
    </div>
  );
}
