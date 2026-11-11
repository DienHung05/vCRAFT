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
 * vCRAFT-8my.1 / ADR-0027: a suspension must be visible on the public household, product, catalog and
 * trace views right after the API commits it, and a reinstatement must clear the stale warning. The
 * exhibition reads are cached (60 s TTL, tagged); the visibility comes from the on-demand
 * `revalidateTag` the API's worker triggers. These tests simulate the Next Data Cache by *honoring the
 * RequestInit options* the helpers send: `cache: 'no-store'` bypasses it, `next: { revalidate, tags }`
 * serves the stored copy until the TTL passes or one of its tags is revalidated.
 */

type FetchInit = RequestInit & {
  next?: { revalidate?: number; tags?: string[] };
  cache?: RequestCache;
};

/** The part of the API the test plays: the current answer per route (404 included). */
type Origin = (path: string) => { status: number; body: unknown };

/** A fake Next data cache in front of the origin: honors `cache`/`next` like the framework does. */
function harness(origin: Origin) {
  const cache = new Map<string, { body: unknown; expiresAt: number; tags: string[] }>();
  let nowMs = 0;
  let originHits = 0;
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
    originHits += 1;
    const { status, body } = origin(path);
    // Next stores 200 answers only.
    if (typeof revalidate === 'number' && status === 200) {
      cache.set(path, { body, expiresAt: nowMs + revalidate * 1000, tags: init?.next?.tags ?? [] });
    }
    return new Response(JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return {
    /** Advance the fake cache clock, e.g. past a 60 s revalidate window. */
    tick: (seconds: number) => {
      nowMs += seconds * 1000;
    },
    /** `revalidateTag(tag, { expire: 0 })`: every stored copy carrying the tag is gone. */
    revalidateTag: (tag: string) => {
      for (const [path, entry] of cache) if (entry.tags.includes(tag)) cache.delete(path);
    },
    /** How many reads got past the cache to the API. */
    originHits: () => originHits,
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
    ratingAverage: null,
    ratingCount: 0,
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
    ratingAverage: null,
    ratingCount: 0,
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

describe('exhibition reads are cached, tagged and dropped on demand (ADR-0027)', () => {
  it('sends revalidate 60 and tags for detail, list, page and trace helpers', async () => {
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
    const calls = callsOf(h);
    for (const [path, init] of calls) {
      expect(init.cache, path).toBeUndefined();
      expect(init.next?.revalidate, path).toBe(60);
      expect(init.next?.tags, path).toContain('exhibition');
    }
    expect(calls.get(`/products/${PRODUCT_SLUG}`)?.next?.tags).toEqual([
      'exhibition',
      `product:${PRODUCT_SLUG}`,
    ]);
    expect(calls.get(`/households/${SLUG}`)?.next?.tags).toEqual([
      'exhibition',
      `household:${SLUG}`,
    ]);
    expect(calls.get(`/trace/${TRACE_CODE}`)?.next?.tags).toEqual([
      'exhibition',
      `trace:${TRACE_CODE}`,
    ]);
    expect(calls.get('/households')?.next?.tags).toEqual(['exhibition']);
  });

  it('leaves out an entity tag the revalidate route would refuse', async () => {
    const h = harness(() => ({ status: 404, body: {} }));
    await fetchProduct('Not A Slug');
    await fetchTrace('abc-1');
    expect(h.calls()).toHaveLength(2);
    for (const [, init] of h.calls()) expect(init?.next?.tags).toEqual(['exhibition']);
  });

  it('keeps the shorter TTL for the redirect and village stats helpers, now tagged', async () => {
    const api = fixture('vi');
    const h = harness(api.origin);
    await Promise.all([fetchSlugRedirect('households', SLUG), fetchVillageStats()]);
    for (const [, init] of h.calls()) {
      expect(init?.next?.revalidate).toBe(30);
      expect(init?.next?.tags).toEqual(['exhibition']);
      expect(init?.cache).toBeUndefined();
    }
  });

  for (const locale of ['vi', 'en'] as const) {
    it(`shows a suspension and a reinstatement at once after revalidateTag, ${locale}`, async () => {
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

      // The admin suspends the household; until the tag is revalidated the warmed copies are served.
      api.suspend();
      h.tick(5);
      await expect(fetchHousehold(SLUG)).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchTrace(TRACE_CODE)).resolves.toMatchObject({
        data: { availability: 'VISIBLE' },
      });

      // The worker's POST /api/revalidate drops the broad tag: every view is fresh on the next request.
      h.revalidateTag('exhibition');
      await expect(fetchHousehold(SLUG)).resolves.toEqual({ status: 'not-found' });
      await expect(fetchProduct(PRODUCT_SLUG)).resolves.toEqual({ status: 'not-found' });
      await expect(fetchTrace(TRACE_CODE)).resolves.toMatchObject({
        status: 'ok',
        data: { availability: 'UNAVAILABLE', reason: 'HOUSEHOLD_SUSPENDED' },
      });
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

      // Reinstate, and the worker revalidates again: the suspension warning is gone at once.
      api.reinstate();
      h.revalidateTag('exhibition');
      await expect(fetchTrace(TRACE_CODE)).resolves.toMatchObject({
        status: 'ok',
        data: { availability: 'VISIBLE', household: { slug: SLUG } },
      });
      await expect(fetchHousehold(SLUG)).resolves.toMatchObject({ status: 'ok' });
      await expect(fetchProducts()).resolves.toMatchObject({
        status: 'ok',
        data: { data: [expect.objectContaining({ slug: PRODUCT_SLUG })] },
      });
    });

    it(`drops one detail by its own tag and leaves the lists cached, ${locale}`, async () => {
      const api = fixture(locale);
      const h = harness(api.origin);
      await fetchHousehold(SLUG);
      await fetchProducts();
      const before = h.originHits();
      h.revalidateTag(`household:${SLUG}`);
      await fetchHousehold(SLUG);
      await fetchProducts();
      // Only the household read went back to the origin.
      expect(h.originHits()).toBe(before + 1);
    });
  }

  it('bounds a revalidation that never arrives by the 60 s TTL', async () => {
    const api = fixture('vi');
    const h = harness(api.origin);
    await fetchProducts();
    api.suspend();
    h.tick(59);
    await expect(fetchProducts()).resolves.toMatchObject({ data: { data: [expect.anything()] } });
    h.tick(2);
    await expect(fetchProducts()).resolves.toMatchObject({ data: { data: [] } });
  });
});
