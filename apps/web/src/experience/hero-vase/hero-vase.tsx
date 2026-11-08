'use client';

import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { canRun3d, readDeviceFacts } from './capability';
import { scrollProgress } from './vase-profiles';

// three.js and R3F load only here, after the decision below, never in the route's first-load JS.
const VaseScene = dynamic(() => import('./vase-scene'), { ssr: false });

/**
 * The 3D glaze vase that forms and turns in the home hero (GH#94, PLAN E13). The page renders the
 * hand-drawn `VaseFigure` underneath, which is the placeholder and the fallback: without WebGL, on phones
 * and low-end devices, with reduced motion or data saver, nothing here loads. Otherwise the scene starts
 * loading right after hydration (GH#215) and cross-fades in over the figure when its first frame is ready,
 * inside the same box, so nothing shifts. `sectionId` is the hero section whose scroll drives the morph.
 */
export function HeroVase({ sectionId }: { sectionId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const progress = useRef(0);

  useEffect(() => {
    if (canRun3d(readDeviceFacts())) setEnabled(true);
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
