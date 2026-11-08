'use client';

import { useTranslations } from 'next-intl';
import type { KeyboardEvent, RefObject } from 'react';
import { Drawer } from 'vaul';
import { AssistantPanel, type AssistantPanelProps } from './assistant-panel';

/** Tab and Shift+Tab stay inside the open desktop panel; Esc closes it. */
function trapFocus(event: KeyboardEvent<HTMLElement>, close: () => void) {
  if (event.key === 'Escape') {
    event.stopPropagation();
    close();
    return;
  }
  if (event.key !== 'Tab') return;
  const focusable = [
    ...event.currentTarget.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), input:not([disabled])',
    ),
  ];
  const first = focusable[0];
  const last = focusable.at(-1);
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last?.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first?.focus();
  }
}

export interface AssistantSheetProps {
  open: boolean;
  /** Phones get a bottom sheet (vaul), larger screens a popover. */
  mobile: boolean;
  onOpenChange: (open: boolean) => void;
  panel: AssistantPanelProps;
  /** Tailwind `bottom-*` class that lifts the sheet above the page's own fixed bars. */
  lift: string;
  viewportHeight: number | null;
  /** Gets focus back when the sheet closes. */
  launcher: RefObject<HTMLButtonElement | null>;
}

/**
 * The open assistant: the bottom sheet on phones, the 380 px popover on desktop. Split from the launcher
 * (`assistant-widget.tsx`) so vaul, radix and the panel are fetched on the first tap, not on hydration.
 */
export function AssistantSheet({
  open,
  mobile,
  onOpenChange,
  panel,
  lift,
  viewportHeight,
  launcher,
}: AssistantSheetProps) {
  const t = useTranslations('assistant');
  const close = () => onOpenChange(false);

  if (mobile) {
    return (
      <Drawer.Root open={open} onOpenChange={onOpenChange}>
        <Drawer.Portal>
          <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/30" />
          <Drawer.Content
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              launcher.current?.focus();
            }}
            aria-describedby={undefined}
            className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-card bg-paper pb-[env(safe-area-inset-bottom)] outline-none"
            style={{
              height: viewportHeight ? `${Math.round(viewportHeight * 0.88)}px` : '85dvh',
            }}
          >
            <Drawer.Title className="sr-only">{t('title')}</Drawer.Title>
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-ink/15" aria-hidden />
            <AssistantPanel {...panel} />
          </Drawer.Content>
        </Drawer.Portal>
      </Drawer.Root>
    );
  }

  return open ? (
    <div
      role="dialog"
      aria-label={t('title')}
      onKeyDown={(event) => trapFocus(event, close)}
      style={{
        maxHeight: 'calc(100dvh - env(safe-area-inset-bottom) - 7rem)',
      }}
      className={`fixed right-4 z-50 flex h-[36rem] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card bg-paper shadow-warm ring-1 ring-ink/10 ${lift}`}
    >
      <AssistantPanel {...panel} />
    </div>
  ) : null;
}
