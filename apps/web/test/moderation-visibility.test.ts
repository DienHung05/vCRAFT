// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  fetchHousehold,
  fetchHouseholdPage,
  fetchHouseholds,
  fetchProduct,
  fetchProductPage,
  fetchProducts,
  fetchSlugRedirect,
  fetchTrace,
  fetchVillageStats,
} from '@/features/catalog/exhibition-api';

/**
 * vCRAFT-8my.1: a suspension must be visible on the public household, product, catalog and trace
 * views on the very next server request, and a reinstatement must clear the stale warning. These
 * tests simulate the Next data cache by *honoring the RequestInit options* the helpers send:
 * `cache: 'no-store'` bypasses the cache, `next: { revalidate }` serves the stored copy until the
 * TTL passes. The production root cause of the reported 100 s staleness is not confirmed; what is
 * pinned here is the contract that the moderation-sensitive helpers must not opt into that cache.
 */

type FetchInit = RequestInit & { next?: { revalidate?: number }; cache?: RequestCache };

/** The part of the API the test plays: the current answer per route (404 included). */
type Origin = (path: string) => { status: number; body: unknown };

/** A fake Next data cache in front of the origin: honors `cache`/`next` like the framework does. */
function harness(origin: Origin) {
  const cache = new Map<string, { body: unknown; expiresAt: number }>();
  let nowMs = 0;
  const fetchMock = vi.fn(async (input: unknown, init?: FetchInit) => {
    const path = String(input).replace(/^https?:\/\/[^/]+\/api\/v1/, '');
    const revalidate = init?.next?.revalidate;
    if (init?.cache !== 'no-store' && typeof revalidate === 'number') {
      const cached = cache.get(path);
      if (cached && cached.expiresAt > nowMs) {
        return new Response(JSON.stringify(cached.body), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      }
    }
    const { status, body } = origin(path);
    if (typeof revalidate === 'number') {
      if (status === 200) cache.set(path, { body, expiresAt: nowMs + revalidate * 1000 });
      else cache.delete(path);
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    /** Advance the fake cache clock, e.g. past a 30 s revalidate window. */
    tick: (seconds: number) => {
      nowMs += seconds * 1000;
    },
    calls: () => fetchMock.mock.calls as ReadonlyArray<[unknown, FetchInit?]>,
  };
}

const UUID = '0192f0d6-0000-7000-8000-0000000000c1';
const TRACE_CODE = 'AB234567';
const SLUG = 'gom-an-phat';
const PRODUCT_SLUG = 'lo-chun-an-phat';

/** A published product of the household, valid per `ProductResponseSchema`. */
function productBody(name: string) {
  return {
    id: UUID,
    version: 3,
    name,
    slug: PRODUCT_SLUG,
    traceCode: TRACE_CODE,
    description: 'A glazed jar.',
    kind: 'OBJECT',
    batchSize: null,
    category: 'VASE',
    priceVnd: 1_200_000,
    stock: 1,
    material: null,
    dimensions: null,
    weightGrams: null,
    artisanNote: null,
    coverUrl: null,
    coverAlt: null,
    images: [],
    status: 'PUBLISHED',
    publishedAt: '2026-01-15T03:00:00.000Z',
    makers: [],
    postedBy: 'HOUSEHOLD_ADMINISTRATION',
  };
}

/** The public profile of the household while APPROVED, valid per `PublicHouseholdResponseSchema`. */
function householdBody(name: string) {
  return {
    id: UUID,
    name,
    slug: SLUG,
    history: 'Three generations of glaze.',
    village: null,
    craft: null,
    coverUrl: null,
    coverVariants: [],
    portrait: null,
    banner: null,
    foundedYear: null,
    generations: null,
    timeline: [],
    certifications: [],
    gallery: [],
    capacityByCategory: { VASE: 1 },
    artisans: [],
    workshops: [],
    visit: { showrooms: [], productionWorkshops: [] },
    products: [productBody(name)],
  };
}

function summaryOf(name: string) {
  return {
    id: UUID,
    name,
    slug: SLUG,
    village: null,
    craft: null,
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    representative: null,
    productCount: 1,
    openingHours: null,
  };
}

function cardOf(name: string) {
  return {
    id: UUID,
    name,
    slug: PRODUCT_SLUG,
    traceCode: TRACE_CODE,
    kind: 'OBJECT',
    category: 'VASE',
    priceVnd: 1_200_000,
    stock: 1,
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    publishedAt: '2026-01-15T03:00:00.000Z',
    household: { name, slug: SLUG },
  };
}

/** The controlled fixture: what GET /api/v1 answers in each moderation state. */
function fixture(locale: 'vi' | 'en') {
  const name = locale === 'vi' ? 'Gốm An Phát' : 'An Phat Ceramics';
  let state: 'APPROVED' | 'SUSPENDED' = 'APPROVED';
  const product = productBody(name);
  const origin: Origin = (path) => {
    if (path === `/households/${SLUG}`)
      return state === 'APPROVED'
        ? { status: 200, body: householdBody(name) }
        : { status: 404, body: { message: 'NOT_FOUND' } };
    if (path === `/products/${PRODUCT_SLUG}`)
      return state === 'APPROVED'
        ? {
            status: 200,
            body: {
              product,
              coverCredit: null,
              household: { name, slug: SLUG },
              journal: { productId: UUID, entries: [], inProgress: false, missingStages: [] },
            },
          }
        : { status: 404, body: { message: 'NOT_FOUND' } };
    if (path === `/trace/${TRACE_CODE}`)
      return state === 'APPROVED'
        ? {
            status: 200,
            body: {
              availability: 'VISIBLE',
              product,
              coverCredit: null,
              household: { name, slug: SLUG, status: 'APPROVED' },
              journal: { productId: UUID, entries: [], inProgress: false, missingStages: [] },
              scanCount: 0,
            },
          }
        : {
            status: 200,
            body: {
              availability: 'UNAVAILABLE',
              traceCode: TRACE_CODE,
              reason: 'HOUSEHOLD_SUSPENDED',
            },
          };
    if (path.startsWith('/products?'))
      return state === 'APPROVED'
        ? {
            status: 200,
            body: {
              data: [cardOf(name)],
              nextCursor: null,
              page: 1,
              pageSize: 24,
              total: 1,
              totalPages: 1,
            },
          }
        : {
            status: 200,
            body: { data: [], nextCursor: null, page: 1, pageSize: 24, total: 0, totalPages: 0 },
          };
    if (path === '/households' || path.startsWith('/households?'))
      return state === 'APPROVED'
        ? {
            status: 200,
            body: {
              data: [summaryOf(name)],
              nextCursor: null,
              page: 1,
              pageSize: 24,
              total: 1,
              totalPages: 1,
            },
          }
        : {
            status: 200,
            body: { data: [], nextCursor: null, page: 1, pageSize: 24, total: 0, totalPages: 0 },
          };
    if (path === '/village/stats')
      return {
        status: 200,
        body:
          state === 'APPROVED'
            ? { households: 1, products: 1, artisans: 0 }
            : { households: 0, products: 0, artisans: 0 },
      };
    if (path.startsWith('/redirects/')) return { status: 200, body: { slug: SLUG } };
    return { status: 404, body: {} };
  };
  return {
    origin,
    suspend: () => {
      state = 'SUSPENDED';
    },
    reinstate: () => {
      state = 'APPROVED';
    },
  };
}

function callsOf(h: ReturnType<typeof harness>) {
  return new Map(
    h
      .calls()
      .map(([input, init]) => [
        String(input).replace(/^https?:\/\/[^/]+\/api\/v1/, ''),
        init ?? {},
      ]),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('moderation-sensitive public fetches bypass the data cache (vCRAFT-8my.1)', () => {
  it('sends cache: no-store for detail, list, page and trace helpers', async () => {
    const api = fixture('vi');
    const h = harness(api.origin);
    await Promise.all([
      fetchProducts(),
      fetchProductPage({ page: 1, limit: 12 }),
      fetchProduct(PRODUCT_SLUG),
      fetchHouseholds(),
      fetchHouseholdPage(1, 12),
      fetchHousehold(SLUG),
      fetchTrace(TRACE_CODE),
    ]);
    for (const [path, init] of callsOf(h)) {
      expect(init.cache, path).toBe('no-store');
      expect(init.next, path).toBeUndefined();
    }
  });

  it('keeps revalidate only for the slow-changing redirect and village stats helpers', async () => {
    const api = fixture('vi');
    const h = harness(api.origin);
    await Promise.all([fetchSlugRedirect('households', SLUG), fetchVillageStats()]);
    for (const [, init] of h.calls()) {
      expect(init?.next?.revalidate).toBe(30);
      expect(init?.cache).toBeUndefined();
    }
  });

  for (const locale of ['vi', 'en'] as const) {
    it(`serves fresh answers across suspend and reinstate after a warm ${locale} cache`, async () => {
      const api = fixture(locale);
      const h = harness(api.origin);

      // Warm every public view as a guest would before the moderation decision.
      await expect(fetchHousehold(SLUG)).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchProduct(PRODUCT_SLUG)).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchTrace(TRACE_CODE)).resolves.toMatchObject({
        status: 'ok',
        data: { availability: 'VISIBLE' },
      });
      await expect(fetchProducts()).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchHouseholds()).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchHouseholdPage(1, 12)).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchProductPage({ page: 1, limit: 12 })).resolves.toMatchObject({
        status: 'ok',
      });
      await expect(fetchVillageStats()).resolves.toMatchObject({ status: 'ok' });

      // The admin suspends the household; the API reflects it at once.
      api.suspend();
      h.tick(5); // well inside a 30 s revalidate window

      // Detail and trace views recheck the API every request: suspended, not the warmed copy.
      await expect(fetchHousehold(SLUG)).resolves.toEqual({ status: 'not-found' });
      await expect(fetchProduct(PRODUCT_SLUG)).resolves.toEqual({ status: 'not-found' });
      await expect(fetchTrace(TRACE_CODE)).resolves.toMatchObject({
        status: 'ok',
        data: { availability: 'UNAVAILABLE', reason: 'HOUSEHOLD_SUSPENDED' },
      });
      // Catalog listings hide the suspended household and its products too.
      await expect(fetchProducts()).resolves.toMatchObject({ status: 'ok', data: { data: [] } });
      await expect(fetchHouseholds()).resolves.toMatchObject({ status: 'ok', data: { data: [] } });
      await expect(fetchHouseholdPage(1, 12)).resolves.toMatchObject({
        status: 'ok',
        data: { total: 0 },
      });
      await expect(fetchProductPage({ page: 1, limit: 12 })).resolves.toMatchObject({
        status: 'ok',
        data: { total: 0 },
      });

      // Control: the harness itself honors revalidate, so the stats helper still serves its warmed copy.
      await expect(fetchVillageStats()).resolves.toMatchObject({
        status: 'ok',
        data: { households: 1 },
      });
      h.tick(31); // past the 30 s TTL
      await expect(fetchVillageStats()).resolves.toMatchObject({
        status: 'ok',
        data: { households: 0 },
      });

      // Reinstate: the stale suspension warning disappears on the next request.
      api.reinstate();
      await expect(fetchTrace(TRACE_CODE)).resolves.toMatchObject({
        status: 'ok',
        data: { availability: 'VISIBLE', household: { slug: SLUG } },
      });
      await expect(fetchHousehold(SLUG)).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchProducts()).resolves.toMatchObject({
        status: 'ok',
        data: { data: [expect.objectContaining({ slug: PRODUCT_SLUG })] },
      });

      // Every moderation-sensitive recheck actually reached the origin (no cache hit served it).
      const calls = callsOf(h);
      expect(calls.get(`/households/${SLUG}`)?.cache).toBe('no-store');
      expect(calls.get(`/products/${PRODUCT_SLUG}`)?.cache).toBe('no-store');
      expect(calls.get(`/trace/${TRACE_CODE}`)?.cache).toBe('no-store');
      expect(calls.get('/products?')?.cache).toBe('no-store');
      expect(calls.get('/households')?.cache).toBe('no-store');
    });
  }
});
