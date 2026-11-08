import { renderHook, waitFor } from '@testing-library/react';
import type { ProductCardDto } from '@vcraft/contracts';
import * as routing from '@vcraft/i18n/routing';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogExplorer } from '@/features/catalog/catalog-explorer';
import { EMPTY_FILTERS } from '@/features/catalog/catalog-filters';
import { ProductCard } from '@/features/catalog/product-card';
import { toProductCardView } from '@/features/catalog/view-models';
import { hasAuthCookie } from '@/lib/auth/session-cookie';
import { useAccount } from '@/lib/auth/use-account';
import { renderVi } from './render';

const browserSupabase = vi.fn();
vi.mock('@/lib/auth/supabase-browser', () => ({
  browserSupabase: () => browserSupabase(),
}));

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

function card(id: string): ProductCardDto {
  return {
    id,
    name: `Item ${id}`,
    slug: `item-${id}`,
    traceCode: `CODE${id}`,
    kind: 'BATCH',
    category: 'VASE',
    priceVnd: 100_000,
    stock: 3,
    coverUrl: `https://cdn.test/cover-${id}.webp`,
    coverVariants: [],
    coverAlt: `Cover ${id}`,
    coverAltEn: null,
    publishedAt: null,
    household: { name: 'Household', slug: 'household' },
  };
}

describe('product card image priority (NFR-PERF-01)', () => {
  it('loads the picture eagerly with high fetch priority when the card is above the fold', () => {
    const { container } = renderVi(<ProductCard product={toProductCardView(card('1'))} priority />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('eager');
    expect(img?.getAttribute('fetchpriority')).toBe('high');
  });

  it('keeps the picture lazy by default', () => {
    const { container } = renderVi(<ProductCard product={toProductCardView(card('1'))} />);
    const img = container.querySelector('img');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(img?.hasAttribute('fetchpriority')).toBe(false);
  });

  it('makes only the first four cards of the catalog grid eager', () => {
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() })),
    );
    window.history.replaceState(null, '', '/vi/san-pham');
    const items = ['1', '2', '3', '4', '5', '6'].map(card);
    const { container } = renderVi(
      <CatalogExplorer
        initialFilters={EMPTY_FILTERS}
        initialItems={items}
        initialTotal={6}
        initialTotalPages={1}
        households={[]}
      />,
    );
    const loading = [...container.querySelectorAll('[data-testid="product-grid"] img')].map((img) =>
      img.getAttribute('loading'),
    );
    expect(loading).toEqual(['eager', 'eager', 'eager', 'eager', 'lazy', 'lazy']);
    vi.unstubAllGlobals();
  });
});

describe('hasAuthCookie', () => {
  it('is false for a guest, whatever else the browser holds', () => {
    expect(hasAuthCookie('')).toBe(false);
    expect(hasAuthCookie('vcraft-remember=0; theme=dark')).toBe(false);
  });

  it('is true for the Supabase session cookie, whole or chunked', () => {
    expect(hasAuthCookie('theme=dark; sb-abc-auth-token=base64-xyz')).toBe(true);
    expect(hasAuthCookie('sb-abc-auth-token.0=aaa; sb-abc-auth-token.1=bbb')).toBe(true);
  });

  it('ignores a cookie that merely mentions the name in its value', () => {
    expect(hasAuthCookie('note=sb-abc-auth-token')).toBe(false);
  });
});

describe('useAccount without a session cookie (NFR-PERF-05)', () => {
  beforeEach(() => {
    browserSupabase.mockReset();
  });
  afterEach(() => {
    // biome-ignore lint/suspicious/noDocumentCookie: the hook reads document.cookie, so the test sets it the same way.
    document.cookie = 'sb-abc-auth-token=; Max-Age=0; path=/';
  });

  it('settles as guest without loading the Supabase client', async () => {
    const { result } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.status).toBe('guest'));
    expect(browserSupabase).not.toHaveBeenCalled();
  });

  it('loads the Supabase client when the auth cookie is present', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: the hook reads document.cookie, so the test sets it the same way.
    document.cookie = 'sb-abc-auth-token=base64-xyz; path=/';
    const unsubscribe = vi.fn();
    browserSupabase.mockReturnValue({
      auth: {
        onAuthStateChange: (callback: (event: string, session: null) => void) => {
          callback('INITIAL_SESSION', null);
          return { data: { subscription: { unsubscribe } } };
        },
      },
    });
    const { result, unmount } = renderHook(() => useAccount());
    await waitFor(() => expect(result.current.status).toBe('guest'));
    expect(browserSupabase).toHaveBeenCalledTimes(1);
    unmount();
    expect(unsubscribe).toHaveBeenCalled();
  });
});

describe('@vcraft/i18n/routing', () => {
  it('exposes the routing data without the message files a client bundle must not carry', () => {
    expect(routing.locales).toEqual(['vi', 'en']);
    expect(routing.defaultLocale).toBe('vi');
    expect('messages' in routing).toBe(false);
  });
});
