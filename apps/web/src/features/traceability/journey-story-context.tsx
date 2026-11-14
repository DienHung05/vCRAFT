'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

interface JourneyStoryValue {
  /** Index of the step in focus, shared by the timeline (right) and the story card (left). */
  active: number;
  setActive: (index: number) => void;
  /** Scrolls to a step and focuses it; a no-op until the timeline registered itself. */
  goTo: (index: number) => void;
  registerGoTo: (fn: ((index: number) => void) | null) => void;
}

const Context = createContext<JourneyStoryValue | null>(null);

/** Shares the step in focus between the two pages of the trace spread (the story card and the fire timeline). */
export function JourneyStoryProvider({ children }: { children: ReactNode }) {
  const [active, setActive] = useState(0);
  const goToRef = useRef<((index: number) => void) | null>(null);
  const registerGoTo = useCallback((fn: ((index: number) => void) | null) => {
    goToRef.current = fn;
  }, []);
  const goTo = useCallback((index: number) => goToRef.current?.(index), []);
  const value = useMemo(
    () => ({ active, setActive, goTo, registerGoTo }),
    [active, goTo, registerGoTo],
  );
  return <Context value={value}>{children}</Context>;
}

/** The shared story state, or null when no provider wraps the page (a lone timeline keeps its own state). */
export function useJourneyStory(): JourneyStoryValue | null {
  return useContext(Context);
}
