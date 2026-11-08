import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { ProductCardDto } from '@vcraft/contracts';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCard } from '@/features/catalog/product-card';
import { suggestionEntries } from '@/features/catalog/suggestions';
import { toProductCardView } from '@/features/catalog/view-models';
import { FavouritesStore, favouritesStore } from '@/features/favourites/favourites-store';
import {
  FAVOURITES_STORAGE_KEY,
  readLocalFavourites,
} from '@/features/favourites/local-favourites';
import { optionalTextFor, textFor } from '@/lib/localized-text';
import { renderEn, renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

const ID = '00000000-0000-4000-8000-00000000000';

function card(n: number, overrides: Partial<ProductCardDto> = {}): ProductCardDto {
  return {
    id: `${ID}${n}`,
    name: `Bình ${n}`,
    nameEn: null,
    slug: `binh-${n}`,
    traceCode: `CODE000${n}`,
    kind: 'OBJECT',
    category: 'VASE',
    priceVnd: 100_000,
    stock: 1,
    status: 'PUBLISHED',
    tags: [],
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    coverAltEn: null,
    publishedAt: null,
    household: { name: 'Hộ A', slug: 'ho-a' },
    ...overrides,
  };
}

function fakeApi(saved: ProductCardDto[] = []) {
  return {
    favourites: vi.fn(async () => ({ data: saved })),
    addFavourite: vi.fn(async (_id: string) => undefined),
    removeFavourite: vi.fn(async (_id: string) => undefined),
  };
}

beforeEach(() => {
  window.localStorage.clear();
  favouritesStore.reset();
});

describe('English product text (FR-CAT-08)', () => {
  it('shows the English name on /en when present, else the Vietnamese one', () => {
    const withEn = card(1, { nameEn: 'Blue vase' });
    expect(toProductCardView(withEn, 'en').name).toBe('Blue vase');
    expect(toProductCardView(withEn, 'vi').name).toBe('Bình 1');
    expect(toProductCardView(card(2), 'en').name).toBe('Bình 2');
    expect(toProductCardView(card(3, { nameEn: '   ' }), 'en').name).toBe('Bình 3');
  });

  it('falls back field by field', () => {
    expect(textFor('en', 'Cao 32 cm', 'Height 32 cm')).toBe('Height 32 cm');
    expect(textFor('vi', 'Cao 32 cm', 'Height 32 cm')).toBe('Cao 32 cm');
    expect(optionalTextFor('en', null, null)).toBeNull();
    expect(optionalTextFor('en', 'Đất sét', null)).toBe('Đất sét');
    expect(optionalTextFor('en', 'Đất sét', 'Clay')).toBe('Clay');
  });

  it('labels search suggestions in the page locale', () => {
    const results = {
      products: [{ name: 'Bình', nameEn: 'Vase', slug: 'binh', household: 'Hộ A' }],
      households: [],
      categories: [],
      news: [],
    };
    expect(suggestionEntries(results, String, 'en')[0]?.label).toBe('Vase');
    expect(suggestionEntries(results, String, 'vi')[0]?.label).toBe('Bình');
  });
});

describe('local favourites storage', () => {
  it('reads junk and a throwing storage as an empty list', () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, '{not json');
    expect(readLocalFavourites()).toEqual([]);
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify(['a', 3, 'a', 'b']));
    expect(readLocalFavourites()).toEqual(['a', 'b']);
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readLocalFavourites()).toEqual([]);
    spy.mockRestore();
  });
});

describe('favourite toggle on a product card', () => {
  it('is a button with aria-pressed and a label naming the product', () => {
    renderVi(<ProductCard product={toProductCardView(card(1), 'vi')} />);
    const button = screen.getByRole('button', { name: 'Lưu Bình 1 vào yêu thích' });
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps a guest list in localStorage', async () => {
    renderEn(<ProductCard product={toProductCardView(card(1), 'en')} />);
    const button = await screen.findByRole('button', { name: /Save Bình 1 to favourites/ });
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('true'));
    expect(JSON.parse(window.localStorage.getItem(FAVOURITES_STORAGE_KEY) ?? '[]')).toEqual([
      `${ID}1`,
    ]);
    fireEvent.click(button);
    await waitFor(() => expect(button.getAttribute('aria-pressed')).toBe('false'));
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();
  });

  it('calls the API when signed in and undoes the change when it fails', async () => {
    const api = fakeApi([card(1)]);
    favouritesStore.reset(api);
    renderEn(
      <>
        <ProductCard product={toProductCardView(card(1), 'en')} />
        <ProductCard product={toProductCardView(card(2), 'en')} />
      </>,
    );
    const [first, second] = await screen.findAllByRole('button', { name: /to favourites/ });
    await waitFor(() => expect(first?.getAttribute('aria-pressed')).toBe('true'));
    expect(second?.getAttribute('aria-pressed')).toBe('false');

    fireEvent.click(second as HTMLElement);
    await waitFor(() => expect(api.addFavourite).toHaveBeenCalledWith(`${ID}2`));
    expect(second?.getAttribute('aria-pressed')).toBe('true');
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();

    fireEvent.click(first as HTMLElement);
    await waitFor(() => expect(api.removeFavourite).toHaveBeenCalledWith(`${ID}1`));
    expect(first?.getAttribute('aria-pressed')).toBe('false');

    api.addFavourite.mockRejectedValueOnce(new Error('offline'));
    fireEvent.click(first as HTMLElement);
    await waitFor(() => expect(first?.getAttribute('aria-pressed')).toBe('false'));
  });
});

describe('merge on sign-in', () => {
  it('moves local favourites into the account once and clears local storage', async () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([`${ID}1`, `${ID}2`]));
    const api = fakeApi([card(1), card(2), card(3)]);
    const store = new FavouritesStore(api);
    await act(async () => {
      await store.startAsAccount();
      // A second sighting of the session does not merge again.
      await store.startAsAccount();
    });
    expect(api.addFavourite).toHaveBeenCalledTimes(2);
    expect(api.addFavourite).toHaveBeenCalledWith(`${ID}1`);
    expect(window.localStorage.getItem(FAVOURITES_STORAGE_KEY)).toBeNull();
    expect(api.favourites).toHaveBeenCalledTimes(1);
    expect([...store.getSnapshot().ids].sort()).toEqual([`${ID}1`, `${ID}2`, `${ID}3`]);
  });

  it('keeps ids that could not be merged for a retry, and drops hidden products', async () => {
    window.localStorage.setItem(
      FAVOURITES_STORAGE_KEY,
      JSON.stringify([`${ID}1`, `${ID}2`, `${ID}3`]),
    );
    const api = fakeApi();
    api.addFavourite.mockImplementation(async (id: string) => {
      if (id === `${ID}2`) throw Object.assign(new Error('gone'), { status: 404 });
      if (id === `${ID}3`) throw Object.assign(new Error('boom'), { status: 500 });
    });
    const store = new FavouritesStore(api);
    await act(async () => {
      await store.startAsAccount();
    });
    expect(readLocalFavourites()).toEqual([`${ID}3`]);
  });

  it('falls back to the guest list when the session turns out to be stale', async () => {
    window.localStorage.setItem(FAVOURITES_STORAGE_KEY, JSON.stringify([`${ID}1`]));
    const api = fakeApi();
    api.addFavourite.mockRejectedValue(Object.assign(new Error('401'), { status: 401 }));
    api.favourites.mockRejectedValue(Object.assign(new Error('401'), { status: 401 }));
    const store = new FavouritesStore(api);
    await act(async () => {
      await store.startAsAccount();
    });
    expect(store.getSnapshot().mode).toBe('guest');
    expect([...store.getSnapshot().ids]).toEqual([`${ID}1`]);
  });
});
