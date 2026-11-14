'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { canRun3d, readDeviceFacts } from './capability';
import { FORM_SECONDS } from './turning-vase';
import { scrollProgress } from './vase-profiles';

// three.js and R3F load only here, after the decision below, never in the route's first-load JS.
const VaseScene = dynamic(() => import('./vase-scene'), { ssr: false });

/** Starts downloading the 3D chunk without waiting for the canvas to mount. */
const loadScene = () => import('./vase-scene');

/** Set on `<html>` by `HERO_3D_FLAG_SCRIPT` before first paint (or by this component) when the device can run 3D. */
const FLAG = 'data-hero-3d';
/** If the scene is not ready this long after it was enabled, fall back to the SVG vase. */
const READY_TIMEOUT_MS = 5000;

const findSvg = (sectionId: string) =>
  document.getElementById(sectionId)?.querySelector<SVGSVGElement>('[data-testid="turning-vase"]');

/**
 * The 3D glaze vase that forms and turns in the home hero (GH#94, PLAN E13). The page renders the
 * server-side `TurningVase` underneath (GH#316): it is the fallback for phones, low-end devices, no
 * WebGL, reduced motion and data saver, where nothing here loads. GH#527: on devices that can run 3D, an
 * inline script has already set `data-hero-3d` on `<html>` before first paint (on a client navigation,
 * where scripts do not run, this component sets it in a layout effect), which hides the SVG, so the 3D
 * story starts at once and plays once instead of the SVG story playing first. The canvas fades in
 * over the tinted box after its first frame, so nothing shifts or flashes. If the scene is not ready
 * within a few seconds (chunk or WebGL failure) the flag is removed and the SVG story is restarted.
 * `sectionId` is the hero section whose scroll drives the morph.
 */
export function HeroVase({ sectionId }: { sectionId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [ready, setReady] = useState(false);
  const progress = useRef(0);
  const timer = useRef<number | undefined>(undefined);
  const onReady = useCallback(() => {
    window.clearTimeout(timer.current);
    setReady(true);
  }, []);

  useEffect(() => {
    // SMIL ignores prefers-reduced-motion: show the finished vase at once instead of the forming story.
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      const svg = findSvg(sectionId);
      if (svg && typeof svg.pauseAnimations === 'function') {
        svg.setCurrentTime(FORM_SECONDS.glaze + FORM_SECONDS.glazeFor);
        svg.pauseAnimations();
      }
    }
  }, [sectionId]);

  // A layout effect, so a client-side navigation to the home page hides the SVG before it is painted.
  useLayoutEffect(() => {
    const root = document.documentElement;
    // A full page load already has the flag from the inline script; a client navigation does not run it.
    if (!root.hasAttribute(FLAG)) {
      if (!canRun3d(readDeviceFacts())) return;
      root.setAttribute(FLAG, '');
    }
    const fallBack = () => {
      window.clearTimeout(timer.current);
      root.removeAttribute(FLAG);
      const svg = findSvg(sectionId);
      if (svg && typeof svg.unpauseAnimations === 'function') {
        svg.setCurrentTime(0);
        svg.unpauseAnimations();
      }
      setEnabled(false);
    };
    // The SVG is hidden: do no animation work behind it, and watch for a scene that never arrives.
    const svg = findSvg(sectionId);
    if (svg && typeof svg.pauseAnimations === 'function') svg.pauseAnimations();
    timer.current = window.setTimeout(fallBack, READY_TIMEOUT_MS);
    loadScene().catch(fallBack);
    setEnabled(true);
    return () => window.clearTimeout(timer.current);
  }, [sectionId]);

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
