import { act } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { createFormatter, createTranslator } from 'next-intl';
import type { ReactElement } from 'react';
import { Suspense, use } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import TracePage from '@/app/[locale]/truy-xuat/[code]/page';
import { tintOf } from '@/features/catalog/view-models';
import { formats } from '@/i18n/formats';
import { renderVi } from './render';

// Regression for vCRAFT-42g / GH#517: the craft-book rewrite of the trace page stopped passing `pieceKind`
// and `glaze` to the timeline, so the production journey fell back to a flat list. This renders the real
// page and timeline; only the data, the client islands unrelated to the journey and the figure's props
// probe are stubbed.
vi.mock('next-intl/server', () => ({
  getTranslations: async (namespace: string) =>
    createTranslator({ locale: 'vi', messages: messages.vi, namespace: namespace as 'trace' }),
  getFormatter: async () =>
    createFormatter({ locale: 'vi', formats, timeZone: 'Asia/Ho_Chi_Minh' }),
}));
vi.mock('@/lib/locale', () => ({ resolveLocale: vi.fn(async () => 'vi') }));
vi.mock('@/features/catalog/exhibition-api', () => ({
  fetchTrace: vi.fn(),
  fetchHousehold: vi.fn(async () => ({ status: 'not-found' })),
}));
vi.mock('@/components/shell/locale-switcher', () => ({ LocaleSwitcher: () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));
vi.mock('@/features/traceability/journey-story-card', () => ({ JourneyStoryCard: () => null }));
vi.mock('@/features/traceability/trace-qr', () => ({ TraceQr: () => null }));
vi.mock('@/features/exhibition/visit-section', () => ({ VisitSection: () => null }));
vi.mock('@/features/exhibition/maker-credits', () => ({ MakerCredits: () => null }));
// The timeline is an async server component; a client test tree can only read its element through `use`.
const timelines = new Map<string, Promise<ReactElement>>();
vi.mock('@/features/traceability/fire-timeline', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/features/traceability/fire-timeline')>();
  return {
    FireTimeline: (props: Parameters<typeof real.FireTimeline>[0]) => {
      const key = JSON.stringify(props);
      let element = timelines.get(key);
      if (!element) {
        element = real.FireTimeline(props);
        timelines.set(key, element);
      }
      return use(element);
    },
  };
});
vi.mock('@/features/traceability/fire-story-scroll', () => ({
  trackFireStory: vi.fn(() => () => {}),
}));
vi.mock('@/features/traceability/piece-figure', () => ({
  PieceFigure: ({ kind, glaze }: { kind: string; glaze: string }) => (
    <div className="piece" data-kind={kind} data-glaze={glaze} />
  ),
}));

const { fetchTrace } = await import('@/features/catalog/exhibition-api');

const CODE = 'AB23CD45';
const props = { params: Promise.resolve({ locale: 'vi', code: CODE }) } as never;
const STAGES = ['clay', 'throw', 'dry', 'paint', 'fire'] as const;

function trace(name: string, category: string, entries = STAGES) {
  return {
    status: 'ok',
    data: {
      availability: 'VISIBLE',
      scanCount: 3,
      product: {
        name,
        nameEn: null,
        slug: 'mon-do',
        traceCode: CODE,
        category,
        status: 'PUBLISHED',
        coverUrl: null,
        coverAlt: null,
        coverAltEn: null,
        coverVariants: [],
        artisanNote: null,
        makers: [],
      },
      household: { name: 'Gốm Minh Hải', slug: 'gom-minh-hai', status: 'APPROVED' },
      journal: {
        productId: 'p1',
        entries: entries.map((stage, seq) => ({
          seq,
          stage,
          declaredDate: `2026-03-0${seq + 1}`,
          note: `Ghi chú ${stage}`,
          images: [],
          supersedesSeq: null,
          skipReason: null,
          prevHash: 'p'.repeat(64),
          hash: `${seq}`.repeat(64),
        })),
      },
    },
  } as never;
}

async function renderPage() {
  const element = await TracePage(props);
  let result!: ReturnType<typeof renderVi>;
  await act(async () => {
    result = renderVi(<Suspense>{element}</Suspense>);
  });
  return result.container;
}

beforeEach(() => {
  vi.clearAllMocks();
  timelines.clear();
});

describe('the trace page tells the production journey as a story (vCRAFT-42g)', () => {
  it('gives the timeline the piece of the product, in the glaze of its trace code', async () => {
    vi.mocked(fetchTrace).mockResolvedValue(trace('Bát chiết yêu men nâu', 'TABLEWARE'));
    const container = await renderPage();
    expect(container.querySelector('[aria-labelledby="journey-title"] .fire-story')).toBeTruthy();
    const piece = container.querySelector('.fire-figure .piece');
    expect(piece?.getAttribute('data-kind')).toBe('bowl');
    expect(piece?.getAttribute('data-glaze')).toBe(tintOf(CODE));
    // The steps are still the readable list with their `#log-N` anchors.
    expect(container.querySelectorAll('li[data-fire-step][id^="log-"]')).toHaveLength(5);
  });

  it('draws the shape that matches the product, not a fixed one', async () => {
    vi.mocked(fetchTrace).mockResolvedValue(trace('Bình hút lộc men lam', 'VASE'));
    const container = await renderPage();
    expect(container.querySelector('.fire-figure .piece')?.getAttribute('data-kind')).toBe('vase');
  });

  it('shows no illustration for a journal that has no entry yet', async () => {
    vi.mocked(fetchTrace).mockResolvedValue(
      trace('Bát chiết yêu men nâu', 'TABLEWARE', [] as never),
    );
    const container = await renderPage();
    expect(container.querySelector('.fire-story')).toBeNull();
  });
});
