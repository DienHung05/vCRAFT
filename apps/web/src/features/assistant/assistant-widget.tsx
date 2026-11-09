'use client';

import { Mascot, type MascotMood, useMascotPoke } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { AssistantPanelProps } from './assistant-panel';
import { freshThoughts, HELLO_DELAY_MS, HELLO_KEY, HELLO_PAGES, pageKind } from './conversation';
import { useAssistant } from './use-assistant';

const MOBILE = '(max-width: 639px)';

/** The map page flags its phone bottom sheet on the root element (GH#297); the Fox must not cover it. */
const MAP_SHEET_HIDDEN = '[html[data-map-sheet=open]_&]:hidden';
/**
 * The panel, the bottom sheet (vaul, radix) and the focus trap load on the first tap on the Fox, not with
 * the launcher: most visitors never open the assistant.
 */
const loadSheet = () => import('./assistant-sheet');
const AssistantSheet = dynamic(() => loadSheet().then((m) => m.AssistantSheet), { ssr: false });

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
  // Stays true after the first open so the sheet keeps its close animation and the chat state.
  const [sheetLoaded, setSheetLoaded] = useState(false);
  const [hello, setHello] = useState(false);
  const launcher = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);
  useEffect(() => {
    if (wasOpen.current && !open) launcher.current?.focus();
    wasOpen.current = open;
    if (open) setSheetLoaded(true);
  }, [open]);
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
  }, []);
  // Clicks on the Fox, in the launcher or the panel header, count towards the dizzy face (GH#211).
  const { reaction, poke } = useMascotPoke();
  const toggle = () => {
    poke();
    dismissHello();
    setOpen((o) => !o);
  };

  const panel: AssistantPanelProps = {
    archive: assistant.archive,
    onHistory: assistant.refreshArchive,
    onRestore: assistant.restore,
    onDelete: assistant.removeFromArchive,
    messages,
    busy,
    page,
    onSend: assistant.send,
    onStop: assistant.stop,
    onRetry: assistant.retry,
    onReset: assistant.reset,
    onRate: assistant.rate,
    onClose: close,
    mascot: (
      // Pointer only (GH#211): the panel's tab order and focus trap stay as they were; keyboard users poke
      // the Fox through the launcher.
      <button
        type="button"
        onClick={poke}
        tabIndex={-1}
        aria-hidden="true"
        className="block rounded-full"
      >
        <Mascot
          mood={mood}
          reaction={reaction}
          size={96}
          lookAt="pointer"
          label={t('mascotLabel')}
          thought={waiting ? thoughtIndices.map((i) => allThoughts[i] ?? '') : undefined}
          thoughtPortal
        />
      </button>
    ),
  };

  // Above the sticky call-to-action bar of the QR trace page, above the Studio tab bar on phones (GH#257),
  // and above the iOS home bar everywhere. The map page uses the normal corner (GH#297); while its phone
  // bottom sheet is open the launcher and the hello bubble hide instead (see `MAP_SHEET_HIDDEN`).
  const studio = /^\/(vi|en)\/studio(\/|$)/.test(pathname);
  const lift =
    page === 'trace'
      ? 'bottom-[calc(env(safe-area-inset-bottom)+6.5rem)]'
      : studio
        ? 'bottom-[calc(env(safe-area-inset-bottom)+4.5rem)] md:bottom-[calc(env(safe-area-inset-bottom)+1rem)]'
        : 'bottom-[calc(env(safe-area-inset-bottom)+1rem)]';

  return (
    <>
      {hello && !open && (
        <div
          role="status"
          className={`fixed right-4 z-40 flex max-w-64 items-start gap-2 rounded-card bg-surface p-3 text-small shadow-warm ring-1 ring-ink/8 ${lift} ${MAP_SHEET_HIDDEN} mb-20`}
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
        onPointerEnter={() => void loadSheet()}
        onFocus={() => void loadSheet()}
        className={`fixed right-4 z-40 size-16 items-center justify-center rounded-full bg-surface shadow-warm ring-1 ring-ink/10 transition-transform hover:scale-105 focus-visible:outline-2 focus-visible:outline-clay ${lift} ${MAP_SHEET_HIDDEN} ${open ? 'hidden' : 'flex'}`}
      >
        <Mascot
          mood={open ? 'listen' : mood}
          reaction={reaction}
          size={mobile ? 56 : 64}
          lookAt="pointer"
          label={t('mascotLabel')}
        />
      </button>

      {sheetLoaded && (
        <AssistantSheet
          open={open}
          mobile={mobile}
          onOpenChange={setOpen}
          panel={panel}
          lift={lift}
          viewportHeight={viewportHeight}
          launcher={launcher}
        />
      )}
    </>
  );
}
