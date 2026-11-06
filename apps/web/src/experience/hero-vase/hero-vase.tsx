'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { canRun3d, readDeviceFacts } from './capability';
import { scrollProgress } from './vase-profiles';

// three.js and R3F load only here, after the decision below, never in the route's first-load JS.
const VaseScene = dynamic(() => import('./vase-scene'), { ssr: false });

/** Start loading after the first scroll or this long after hydration, whichever comes first. */
const IDLE_START_MS = 2_500;

/**
 * The 3D glaze vase over the hero's poster photo (GH#94, PLAN E13). The photo is rendered by the page and
 * stays the LCP element and the fallback: without WebGL, on phones and low-end devices, with reduced
 * motion or data saver, nothing here loads. Otherwise the scene loads after the first scroll or 2.5 s
 * after hydration, and fades in over the photo when its first frame is ready. `sectionId` is the hero
 * section whose scroll drives the morph.
 */
export function HeroVase({ sectionId }: { sectionId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const progress = useRef(0);

  useEffect(() => {
    if (!canRun3d(readDeviceFacts())) return;
    let started = false;
    const start = () => {
      if (started) return;
      started = true;
      setEnabled(true);
    };
    const timer = window.setTimeout(start, IDLE_START_MS);
    window.addEventListener('scroll', start, { once: true, passive: true });
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('scroll', start);
    };
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
      <VaseScene progress={progress} onReady={() => setReady(true)} />
    </div>
  );
}
