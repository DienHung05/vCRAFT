'use client';

import { durMs, reducedFadeMs } from '@vcraft/ui';
import { createContext, useContext } from 'react';
import { fire as streamEmbers } from './kiln-bus';

/**
 * What a form tells the kiln card while it works. All four calls only touch data attributes on the card
 * (`data-kiln-state`) and the seal (`data-kiln`), which `kiln.css` turns into the glow, crackle, shake and
 * stamp, and they feed the ember island through `kiln-bus`. Outside the shell (tests, other pages) the
 * default context does nothing and `seal` resolves at once.
 */
export interface KilnFeedback {
  /** Submit started: the button fires, the seal heats up, embers stream from the button to the seal. */
  fire: () => void;
  /**
   * Failure: one shake, replayed on every call. Server and auth errors also crackle along the card edge;
   * `'invalid'` (client validation, nothing was sent) is the lighter shake-only reaction.
   */
  fail: (reason?: 'invalid') => void;
  /**
   * Success: the seal stamps and the success line is announced. Resolves after the 520ms hold (150ms under
   * reduced motion), or as soon as another call (`fire`, `fail`, `reset`) interrupts the hold, so the caller
   * never waits forever. The caller then navigates.
   *
   * `destination` is the URL the caller is about to load. The session cookie already exists, so the browser
   * is told to prerender it (Speculation Rules) while the stamp plays: the hold overlaps the destination's
   * server render instead of adding to it. The hint is withdrawn if the seal is interrupted.
   */
  seal: (destination?: string) => Promise<void>;
  /** The flow ended without a stamp (for example the form swapped to another panel): clear everything. */
  reset: () => void;
}

const NO_OP: KilnFeedback = {
  fire: () => {},
  fail: () => {},
  seal: () => Promise.resolve(),
  reset: () => {},
};

export const KilnFeedbackContext = createContext<KilnFeedback>(NO_OP);

export function useKilnFeedback(): KilnFeedback {
  return useContext(KilnFeedbackContext);
}

/** The error state clears itself after its animation; this is the backstop if no `animationend` arrives. */
const ERROR_BACKSTOP_MS = durMs.story + 200;
/** The shake alone (client validation) is over after `dur.base`. */
const INVALID_BACKSTOP_MS = durMs.base + 120;
/** Under reduced motion the crackle is only a fade, so it lingers a little before clearing. */
const ERROR_REDUCED_MS = 900;

const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Marks the document as "leaving through a sealed sign-in": the global `pageswap` guard in the root layout
 * lets a cross-document view transition run only for this navigation (see `lib/view-transition.ts`).
 */
const markSealedNavigation = (on: boolean) => {
  if (on) document.documentElement.dataset.kilnVt = '1';
  else delete document.documentElement.dataset.kilnVt;
};

const SPECULATION_ID = 'kiln-speculation';

/**
 * Asks the browser to prerender `destination` right away (Chromium; elsewhere it is simply not supported).
 * It is skipped when Speculation Rules are unsupported or the person asked to save data. Only the exact URL
 * that is then passed to `location.assign` can be activated, and same-origin redirects are followed.
 */
function startSpeculating(destination: string) {
  stopSpeculating();
  if (!HTMLScriptElement.supports?.('speculationrules')) return;
  if ((navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData)
    return;
  const rules = document.createElement('script');
  rules.type = 'speculationrules';
  rules.id = SPECULATION_ID;
  rules.textContent = JSON.stringify({
    prerender: [{ urls: [destination], eagerness: 'immediate' }],
  });
  document.head.append(rules);
}

/** Withdraws the prerender hint (a failed or interrupted sign-in must not leave a signed-in page warming). */
function stopSpeculating() {
  document.getElementById(SPECULATION_ID)?.remove();
}

/** Builds the feedback for one card. `getHost` returns the `.kiln-card` element (null before mount). */
export function createKilnFeedback(getHost: () => HTMLElement | null): KilnFeedback {
  let sealTimer: ReturnType<typeof setTimeout> | undefined;
  let errorTimer: ReturnType<typeof setTimeout> | undefined;
  let crackleTimer: ReturnType<typeof setTimeout> | undefined;
  let stopListening: (() => void) | undefined;
  let settleSeal: (() => void) | undefined;

  const seal = (host: HTMLElement) =>
    host.closest('.kiln-scene')?.querySelector<HTMLElement>('.kiln-seal') ?? null;

  const setMood = (host: HTMLElement, mood: 'hot' | 'cool' | null) => {
    const mark = seal(host);
    if (!mark) return;
    if (mood) mark.setAttribute('data-kiln', mood);
    else mark.removeAttribute('data-kiln');
  };

  /** Writes (or empties) the success line of the live region; its text comes from the server render. */
  const setStatus = (host: HTMLElement, on: boolean) => {
    const status = host.querySelector<HTMLElement>('[data-kiln-status]');
    if (status) status.textContent = on ? (status.dataset.text ?? '') : '';
  };

  /** Stops every pending timer and settles a pending `seal()`: the caller moves on instead of hanging. */
  const clearTimers = () => {
    clearTimeout(sealTimer);
    clearTimeout(errorTimer);
    stopListening?.();
    stopListening = undefined;
    settleSeal?.();
    settleSeal = undefined;
  };

  /**
   * Freezes the crackle layer at its current opacity so it can fade out after the error state is removed,
   * instead of being cut. Returns the function that starts the fade (call it after the attribute change).
   */
  const holdCrackle = (host: HTMLElement) => {
    const layer = host.querySelector<HTMLElement>('.kiln-crackle-fade');
    if (!layer) return () => {};
    const current = getComputedStyle(layer).opacity;
    if (current === '' || Number(current) <= 0) return () => {};
    layer.style.transition = 'none';
    layer.style.opacity = current;
    return () => {
      void layer.offsetWidth;
      layer.style.transition = '';
      layer.style.opacity = '0';
      clearTimeout(crackleTimer);
      crackleTimer = setTimeout(() => layer.style.removeProperty('opacity'), durMs.base + 40);
    };
  };

  /** Moves the card to `next` (null clears it), fading the error crackle and ending a sealed navigation. */
  const enter = (host: HTMLElement, next: string | null) => {
    const current = host.getAttribute('data-kiln-state');
    const fade = current === 'error' && next !== 'error' ? holdCrackle(host) : null;
    if (current === 'sealed' && next !== 'sealed') {
      markSealedNavigation(false);
      stopSpeculating();
      setStatus(host, false);
    }
    if (next) host.setAttribute('data-kiln-state', next);
    else host.removeAttribute('data-kiln-state');
    fade?.();
  };

  /** Everything off: the state, the seal's mood and any pending timer. */
  const clear = (host: HTMLElement) => {
    clearTimers();
    enter(host, null);
    setMood(host, null);
  };

  return {
    fire() {
      const host = getHost();
      if (!host) return;
      clearTimers();
      enter(host, 'firing');
      setMood(host, 'hot');
      const button = host.querySelector('button[type="submit"]');
      const mark = seal(host);
      if (button && mark) {
        streamEmbers({ from: button.getBoundingClientRect(), to: mark.getBoundingClientRect() });
      }
    },

    fail(reason) {
      const host = getHost();
      if (!host) return;
      clearTimers();
      const light = reason === 'invalid';
      // Remove, force a reflow, add: the CSS animations restart on every failure.
      enter(host, null);
      void host.offsetWidth;
      enter(host, light ? 'invalid' : 'error');
      setMood(host, light ? null : 'cool');
      const state = light ? 'invalid' : 'error';
      const done = () => {
        clearTimers();
        if (host.getAttribute('data-kiln-state') !== state) return;
        enter(host, null);
        setMood(host, null);
      };
      const onEnd = (event: Event) => {
        const target = event.target;
        if (!(target instanceof Element)) return;
        // The crackle layer is the last to finish; the shake alone ends the light reaction.
        const last = light ? target === host : target.classList.contains('kiln-crackle-fade');
        if (!last) return;
        if (prefersReducedMotion() && !light) {
          clearTimeout(errorTimer);
          errorTimer = setTimeout(done, ERROR_REDUCED_MS);
        } else {
          done();
        }
      };
      host.addEventListener('animationend', onEnd);
      stopListening = () => host.removeEventListener('animationend', onEnd);
      errorTimer = setTimeout(done, light ? INVALID_BACKSTOP_MS : ERROR_BACKSTOP_MS);
    },

    seal(destination) {
      const host = getHost();
      if (!host) return Promise.resolve();
      clearTimers();
      enter(host, 'sealed');
      setMood(host, null);
      markSealedNavigation(true);
      if (destination) startSpeculating(destination);
      setStatus(host, true);
      // The embers land as the stamp lands, whatever the network time was.
      const button = host.querySelector('button[type="submit"]');
      const mark = seal(host);
      if (button && mark) {
        streamEmbers({
          from: button.getBoundingClientRect(),
          to: mark.getBoundingClientRect(),
          quick: true,
        });
      }
      // The hold: the stamp finishes inside it. Reduced motion keeps only the 150ms fade.
      const hold = prefersReducedMotion() ? reducedFadeMs : durMs.slow;
      return new Promise<void>((resolve) => {
        settleSeal = resolve;
        sealTimer = setTimeout(() => {
          const settle = settleSeal;
          settleSeal = undefined;
          settle?.();
        }, hold);
      });
    },

    reset() {
      const host = getHost();
      if (!host) {
        clearTimers();
        return;
      }
      clear(host);
    },
  };
}
