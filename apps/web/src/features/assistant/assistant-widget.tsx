'use client';

import { Mascot, type MascotMood } from '@vcraft/ui';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { type KeyboardEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'vaul';
import { AssistantPanel } from './assistant-panel';
import { freshThoughts, HELLO_DELAY_MS, HELLO_KEY, HELLO_PAGES, pageKind } from './conversation';
import { useAssistant } from './use-assistant';

const MOBILE = '(max-width: 639px)';

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const list = window.matchMedia(query);
    setMatches(list.matches);
    const onChange = () => setMatches(list.matches);
    list.addEventListener('change', onChange);
    return () => list.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** Height of the visible viewport, which shrinks when the on-screen keyboard opens. */
function useVisualViewportHeight(active: boolean): number | null {
  const [height, setHeight] = useState<number | null>(null);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!active || !viewport) return;
    const update = () => setHeight(viewport.height);
    update();
    viewport.addEventListener('resize', update);
    return () => viewport.removeEventListener('resize', update);
  }, [active]);
  return height;
}

const readFlag = (key: string) => {
  try {
    return window.localStorage.getItem(key) === '1';
  } catch {
    return false;
  }
};
const writeFlag = (key: string) => {
  try {
    window.localStorage.setItem(key, '1');
  } catch {
    // Blocked storage: the hello may come back on another visit, which is harmless.
  }
};

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
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled])',
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

/**
 * The Fox in the bottom-right corner of public pages (FR-AST-01, 06, PLAN E15 UX): a launcher that opens a
 * 380 px popover on desktop or a bottom sheet on phones. The Fox thinks with rotating fun facts while it
 * waits, talks while the answer streams and refuses when a message is blocked.
 */
export function AssistantWidget() {
  const t = useTranslations('assistant');
  const locale = useLocale() === 'en' ? 'en' : 'vi';
  const pathname = usePathname() || `/${locale}`;
  const page = pageKind(pathname);
  const mobile = useMediaQuery(MOBILE);
  const [open, setOpen] = useState(false);
  const [hello, setHello] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const viewportHeight = useVisualViewportHeight(open && mobile);
  const assistant = useAssistant({ locale, pagePath: pathname });
  const { messages, busy, seenThoughts, markThoughtsSeen } = assistant;
  const last = messages.at(-1);

  // One proactive hello per browser, only on the home page and QR landings; it never opens the panel.
  useEffect(() => {
    if (!HELLO_PAGES.includes(page) || readFlag(HELLO_KEY)) return;
    const timer = setTimeout(() => setHello(true), HELLO_DELAY_MS);
    return () => clearTimeout(timer);
  }, [page]);
  const dismissHello = useCallback(() => {
    setHello(false);
    writeFlag(HELLO_KEY);
  }, []);

  const allThoughts = t.raw('thoughts') as string[];
  const waiting = last?.status === 'pending';
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new set of lines for each wait, not on every render.
  const thoughtIndices = useMemo(
    () => (waiting ? freshThoughts(allThoughts.length, seenThoughts) : []),
    [waiting],
  );
  useEffect(() => {
    if (thoughtIndices.length) markThoughtsSeen(thoughtIndices);
  }, [thoughtIndices, markThoughtsSeen]);

  let mood: MascotMood = 'idle';
  if (last?.status === 'pending') mood = 'think';
  else if (last?.status === 'streaming') mood = 'talk';
  else if (last?.status === 'blocked') mood = 'refuse';
  else if (last?.status === 'error') mood = 'confused';
  else if (hello && !open) mood = 'greet';

  const close = useCallback(() => {
    setOpen(false);
    launcher.current?.focus();
  }, []);
  const toggle = () => {
    dismissHello();
    setOpen((o) => !o);
  };

  const panel = (
    <AssistantPanel
      messages={messages}
      busy={busy}
      page={page}
      onSend={assistant.send}
      onStop={assistant.stop}
      onRetry={assistant.retry}
      onReset={assistant.reset}
      onRate={assistant.rate}
      onClose={close}
      mascot={
        <Mascot
          mood={mood}
          size={96}
          lookAt="pointer"
          label={t('mascotLabel')}
          thought={waiting ? thoughtIndices.map((i) => allThoughts[i] ?? '') : undefined}
        />
      }
    />
  );

  // Above the map's bottom sheet on the map page; above the iOS home bar everywhere.
  const lift =
    page === 'map'
      ? 'bottom-[calc(env(safe-area-inset-bottom)+7rem)]'
      : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]';

  return (
    <>
      {hello && !open && (
        <div
          role="status"
          className={`fixed right-4 z-40 flex max-w-64 items-start gap-2 rounded-card bg-surface p-3 text-small shadow-warm ring-1 ring-ink/8 ${lift} mb-20`}
        >
          <p className="flex-1">{t('hello')}</p>
          <button
            type="button"
            className="-m-1 rounded-input p-1 text-ink/60 hover:text-ink"
            aria-label={t('dismissHello')}
            onClick={dismissHello}
          >
            ×
          </button>
        </div>
      )}

      <button
        ref={launcher}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={open ? t('close') : t('open')}
        onClick={toggle}
        className={`fixed right-4 z-40 flex size-16 items-center justify-center rounded-full bg-surface shadow-warm ring-1 ring-ink/10 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-clay ${lift} ${open && mobile ? 'hidden' : ''}`}
      >
        <Mascot
          mood={open ? 'listen' : mood}
          size={mobile ? 56 : 64}
          lookAt="pointer"
          label={t('mascotLabel')}
        />
      </button>

      {mobile ? (
        <Drawer.Root open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
          <Drawer.Portal>
            <Drawer.Overlay className="fixed inset-0 z-50 bg-ink/30" />
            <Drawer.Content
              aria-describedby={undefined}
              className="fixed inset-x-0 bottom-0 z-50 flex flex-col rounded-t-card bg-paper pb-[env(safe-area-inset-bottom)] outline-none"
              style={{
                height: viewportHeight ? `${Math.round(viewportHeight * 0.88)}px` : '85dvh',
              }}
            >
              <Drawer.Title className="sr-only">{t('title')}</Drawer.Title>
              <div
                className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-ink/15"
                aria-hidden
              />
              {panel}
            </Drawer.Content>
          </Drawer.Portal>
        </Drawer.Root>
      ) : (
        open && (
          <div
            role="dialog"
            aria-label={t('title')}
            onKeyDown={(event) => trapFocus(event, close)}
            className={`fixed right-4 z-50 flex h-[min(36rem,calc(100dvh-8rem))] w-[380px] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-card bg-paper shadow-warm ring-1 ring-ink/10 ${lift} mb-20`}
          >
            {panel}
          </div>
        )
      )}
    </>
  );
}
