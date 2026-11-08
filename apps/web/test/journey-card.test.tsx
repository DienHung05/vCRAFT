import { act, screen, within } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { createFormatter, createTranslator } from 'next-intl';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { JourneyCard } from '@/features/catalog/journey-card';
import type { LogEntryView } from '@/features/catalog/view-models';
import { formats } from '@/i18n/formats';
import { renderVi } from './render';

vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: 'vi', messages: messages.vi, namespace: namespace as 'product' }),
  getFormatter: async () =>
    createFormatter({ locale: 'vi', formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}));
vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: {
    href: { pathname: string; params: { code: string }; hash?: string };
    children: React.ReactNode;
  } & Record<string, unknown>) => (
    <a href={`/truy-xuat/${href.params.code}${href.hash ? `#${href.hash}` : ''}`} {...rest}>
      {children}
    </a>
  ),
}));

const entries: LogEntryView[] = (['clay', 'throw', 'glaze', 'fire', 'finish'] as const).map(
  (stage, seq) => ({
    seq,
    stage,
    at: `2026-03-0${seq + 1}T08:00:00.000Z`,
    note: stage,
    mediaChecksums: [],
    prevHash: 'p'.repeat(64),
    hash: `${seq}`.repeat(64),
    tint: '#8a5a3c',
    images: [],
  }),
);

async function renderCard() {
  return renderVi((await JourneyCard({ entries, traceCode: 'BT7K2QXM' })) as React.ReactElement);
}

/** An IntersectionObserver the test can fire by hand, and a `matchMedia` that reports `reduce` or not. */
function fakeBrowser(reduce: boolean) {
  const observers: { callback: IntersectionObserverCallback }[] = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: IntersectionObserverCallback) {
        observers.push({ callback });
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal('matchMedia', () => ({ matches: reduce }));
  return () =>
    act(() => {
      for (const o of observers) {
        o.callback(
          [{ isIntersecting: true } as IntersectionObserverEntry],
          {} as IntersectionObserver,
        );
      }
    });
}

afterEach(() => vi.unstubAllGlobals());

describe('product journey card (GH#300)', () => {
  it('labels every dot with its stage, links it to that step and draws a stage icon', async () => {
    const { container } = await renderCard();
    const list = screen.getByRole('list', { name: 'Hành trình của món gốm' });
    const links = within(list).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual([
      'Nhào đất',
      'Vuốt dáng',
      'Tráng men',
      'Nung lò',
      'Ra lò',
    ]);
    expect(links.map((l) => l.getAttribute('href'))).toEqual(
      [1, 2, 3, 4, 5].map((n) => `/truy-xuat/BT7K2QXM#log-${n}`),
    );
    expect(container.querySelectorAll('[data-stage-icon]')).toHaveLength(5);
    expect(screen.getByRole('link', { name: /Xem hành trình/ })).toBeTruthy();
  });

  it('staggers the dots by their position', async () => {
    const { container } = await renderCard();
    const delays = Array.from(container.querySelectorAll<HTMLElement>('.journey > li')).map((li) =>
      li.style.getPropertyValue('--i'),
    );
    expect(delays).toEqual(['0', '1', '2', '3', '4']);
  });

  it('stays in its final state when the browser cannot observe or motion is reduced', async () => {
    const { container, unmount } = await renderCard();
    expect(container.querySelector('.journey')?.getAttribute('data-journey')).toBeNull();
    unmount();
    const fire = fakeBrowser(true);
    const reducedCard = await renderCard();
    fire();
    expect(
      reducedCard.container.querySelector('.journey')?.getAttribute('data-journey'),
    ).toBeNull();
  });

  it('arms the dots, then plays them once the card scrolls into view', async () => {
    const fire = fakeBrowser(false);
    const { container } = await renderCard();
    const list = container.querySelector('.journey');
    expect(list?.getAttribute('data-journey')).toBe('armed');
    fire();
    expect(list?.getAttribute('data-journey')).toBe('play');
  });
});
