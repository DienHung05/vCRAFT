'use client';

import { cn } from '@vcraft/ui';
import { type ReactNode, useEffect, useRef } from 'react';

export interface DisclosureProps {
  /** Content of the `<summary>` (the always-visible toggle). */
  summary: ReactNode;
  /** Classes for the `<summary>` toggle. */
  summaryClassName?: string;
  /** Accessible name for the toggle when `summary` is an icon. */
  label?: string;
  /** Classes for the `<details>` wrapper (positioning context for the panel). */
  className?: string;
  /** CSS selector of the element to focus when the panel opens (e.g. a search input). */
  focusOnOpen?: string;
  children: ReactNode;
}

/**
 * `<details>` menu for the header: works without JS, and with JS also closes on Escape (focus goes
 * back to the toggle), on a click outside and when focus leaves the panel (WCAG 2.1.1, 2.4.3, 3.2.1).
 */
export function Disclosure({
  summary,
  summaryClassName,
  label,
  className,
  focusOnOpen,
  children,
}: DisclosureProps) {
  const root = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const close = (event: Event) => {
      const el = root.current;
      if (!el?.open) return;
      if (event instanceof KeyboardEvent) {
        if (event.key !== 'Escape') return;
        el.open = false;
        el.querySelector('summary')?.focus();
        return;
      }
      if (event.target instanceof Node && !el.contains(event.target)) el.open = false;
    };
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', close);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', close);
    };
  }, []);

  return (
    <details
      ref={root}
      className={cn('relative', className)}
      onToggle={(event) => {
        if (focusOnOpen && event.currentTarget.open) {
          event.currentTarget.querySelector<HTMLElement>(focusOnOpen)?.focus();
        }
      }}
      onBlur={(event) => {
        const el = event.currentTarget;
        if (el.open && event.relatedTarget && !el.contains(event.relatedTarget as Node)) {
          el.open = false;
        }
      }}
    >
      <summary
        aria-label={label}
        className={cn(
          'flex min-h-9 cursor-pointer list-none items-center justify-center rounded-input px-3 text-small text-ink hover:bg-ink/6 focus-visible:outline-2 focus-visible:outline-glaze [&::-webkit-details-marker]:hidden',
          summaryClassName,
        )}
      >
        {summary}
      </summary>
      {children}
    </details>
  );
}
