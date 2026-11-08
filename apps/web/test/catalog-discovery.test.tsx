import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { PRODUCT_SORTS } from '@vcraft/contracts';
import { PRODUCT_CATEGORIES, PRODUCT_CATEGORY_LABELS } from '@vcraft/domain';
import { messages } from '@vcraft/i18n';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  catalogSearchParams,
  EMPTY_FILTERS,
  parseCatalogParams,
  toProductFilters,
} from '@/features/catalog/catalog-filters';
import { CommandPalette, openCommandPalette } from '@/features/catalog/command-palette';
import { productsQueryString } from '@/features/catalog/exhibition-query';
import { GalleryTrigger, ProductGallery } from '@/features/catalog/product-gallery';
import { ProductQr } from '@/features/catalog/product-qr';
import { SearchPaletteButton } from '@/features/catalog/search-palette-button';
import { parseSuggestions } from '@/features/catalog/suggestions';
import { gallerySlide } from '@/features/catalog/view-models';
import { renderEn, renderVi } from './render';

const push = vi.hoisted(() => vi.fn());
const qrDownload = vi.hoisted(() => vi.fn(async () => {}));

type Href =
  | string
  | { pathname: string; params?: Record<string, string>; query?: Record<string, string> };
const hrefOf = (href: Href) => {
  if (typeof href === 'string') return href;
  let path = href.pathname;
  for (const [key, value] of Object.entries(href.params ?? {}))
    path = path.replace(`[${key}]`, value);
  const query = new URLSearchParams(href.query ?? {}).toString();
  return query ? `${path}?${query}` : path;
};

vi.mock('@/i18n/navigation', () => ({
  Link: ({
    href,
    children,
    ...rest
  }: { href: Href; children: React.ReactNode } & Record<string, unknown>) => (
    <a href={hrefOf(href)} {...rest}>
      {children}
    </a>
  ),
  useRouter: () => ({ push }),
}));
vi.mock('@/features/traceability/trace-qr', () => ({
  TraceQr: ({ url }: { url: string }) => <div data-testid="qr" data-url={url} />,
  QR_LOGO_URL: '/brand/icon-512.png',
  QR_LOGO_OPTIONS: { margin: 4, hideBackgroundDots: true, imageSize: 0.3 },
}));
vi.mock('qr-code-styling', () => ({
  default: class {
    download = qrDownload;
  },
}));

describe('catalog filters (FR-CAT-02): open workshop and popular sort', () => {
  it('open-workshop filter round-trips through the URL and the API query', () => {
    const filters = parseCatalogParams({ openWorkshop: '1', sort: 'popular' });
    expect(filters).toMatchObject({ openWorkshop: true, sort: 'popular' });
    expect(catalogSearchParams(filters).toString()).toBe('openWorkshop=1&sort=popular');
    expect(productsQueryString(toProductFilters(filters))).toBe(
      'sort=popular&page=1&openWorkshop=true',
    );
    expect(parseCatalogParams({ openWorkshop: '0' }).openWorkshop).toBe(false);
    expect(catalogSearchParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('every sort has a label in both languages', () => {
    for (const sort of PRODUCT_SORTS) {
      expect(messages.vi.catalog.sorts[sort]).toBeTruthy();
      expect(messages.en.catalog.sorts[sort]).toBeTruthy();
    }
  });

  it('the category names the API matches on are the ones the site shows', () => {
    for (const category of PRODUCT_CATEGORIES) {
      expect(PRODUCT_CATEGORY_LABELS[category].vi).toBe(messages.vi.catalog.categories[category]);
      expect(PRODUCT_CATEGORY_LABELS[category].en).toBe(messages.en.catalog.categories[category]);
    }
  });

  it('a suggestions answer without categories (cached before the field existed) reads as none', () => {
    const parsed = parseSuggestions({ products: [], households: [], news: [] });
    expect(parsed.categories).toEqual([]);
    expect(() => parseSuggestions({ products: [{ name: 1 }], households: [], news: [] })).toThrow();
  });
});

const SUGGESTIONS = {
  products: [
    { name: 'Bình hút lộc', slug: 'binh-hut-loc', household: 'Gốm A' },
    { name: 'Bình men lam', slug: 'binh-men-lam', household: 'Gốm B' },
  ],
  households: [{ name: 'Gốm Bát Tràng', slug: 'gom-bat-trang' }],
  categories: [{ category: 'WORSHIP' }],
  news: [{ title: 'Hội làng gốm', slug: 'hoi-lang-gom' }],
};

const answer = (body: unknown = SUGGESTIONS) => new Response(JSON.stringify(body));

describe('CommandPalette (FR-CAT-04)', () => {
  beforeEach(() => push.mockClear());

  const press = (init: KeyboardEventInit) =>
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, ...init }));
    });

  it('renders nothing until Ctrl K opens it; Ctrl K again and Cmd K toggle it', () => {
    renderVi(<CommandPalette fetchSuggestions={vi.fn(async () => answer())} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    press({ key: 'k', ctrlKey: true });
    expect(screen.getByRole('dialog', { name: 'Tìm kiếm nhanh' })).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    press({ key: 'K', ctrlKey: true });
    expect(screen.queryByRole('dialog')).toBeNull();
    press({ key: 'k', metaKey: true });
    expect(screen.getByRole('dialog')).toBeTruthy();
  });

  it('shows products, households, categories and news as groups, each linking to its own page', async () => {
    const fetchSuggestions = vi.fn(async () => answer());
    renderVi(<CommandPalette fetchSuggestions={fetchSuggestions} />);
    press({ key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'do tho' } });
    await screen.findByRole('group', { name: 'Sản phẩm' });
    expect(fetchSuggestions).toHaveBeenCalledTimes(1);
    expect(fetchSuggestions.mock.calls[0]?.[0 as never]).toBe('do tho');
    for (const name of ['Sản phẩm', 'Hộ', 'Danh mục', 'Tin tức']) {
      expect(screen.getByRole('group', { name })).toBeTruthy();
    }
    const link = (name: RegExp | string) => screen.getByRole('option', { name }).querySelector('a');
    expect(link(/Bình hút lộc/)?.getAttribute('href')).toBe('/san-pham/binh-hut-loc');
    expect(link('Gốm Bát Tràng')?.getAttribute('href')).toBe('/nghe-nhan/gom-bat-trang');
    expect(link('Đồ thờ')?.getAttribute('href')).toBe('/san-pham?category=WORSHIP');
    // News go to the article itself, not to the list.
    expect(link('Hội làng gốm')?.getAttribute('href')).toBe('/tin-tuc/hoi-lang-gom');
    expect(link(/Xem mọi sản phẩm khớp/)?.getAttribute('href')).toBe('/san-pham?q=do+tho');
  });

  it('labels a category in the page language', async () => {
    renderEn(<CommandPalette fetchSuggestions={vi.fn(async () => answer())} />);
    press({ key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'altar' } });
    expect(await screen.findByRole('option', { name: 'Altar pieces' })).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Categories' })).toBeTruthy();
  });

  it('arrow keys move the highlight (wrapping) and Enter opens it', async () => {
    renderVi(<CommandPalette fetchSuggestions={vi.fn(async () => answer())} />);
    press({ key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'binh' } });
    await screen.findByRole('group', { name: 'Sản phẩm' });
    const options = screen.getAllByRole('option');
    expect(options[0]?.getAttribute('aria-selected')).toBe('true');
    expect(input.getAttribute('aria-activedescendant')).toBe(options[0]?.id);

    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(options[1]?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    // Up from the first row wraps to the last: "see every product".
    expect(options.at(-1)?.getAttribute('aria-selected')).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith({
      pathname: '/san-pham/[slug]',
      params: { slug: 'binh-men-lam' },
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('Enter with nothing found searches the whole catalog', async () => {
    const empty = { products: [], households: [], categories: [], news: [] };
    renderVi(<CommandPalette fetchSuggestions={vi.fn(async () => answer(empty))} />);
    press({ key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'xyz' } });
    await screen.findByText('Không có gợi ý nào.');
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(push).toHaveBeenCalledWith({ pathname: '/san-pham', query: { q: 'xyz' } });
  });

  it('Esc closes it and focus returns to what had it', () => {
    renderVi(
      <>
        <button type="button">before</button>
        <CommandPalette fetchSuggestions={vi.fn(async () => answer())} />
      </>,
    );
    const opener = screen.getByRole('button', { name: 'before' });
    opener.focus();
    press({ key: 'k', ctrlKey: true });
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it('keeps Tab inside the dialog', () => {
    renderVi(<CommandPalette fetchSuggestions={vi.fn(async () => answer())} />);
    press({ key: 'k', ctrlKey: true });
    const dialog = screen.getByRole('dialog');
    const close = within(dialog).getByRole('button', { name: 'Đóng' });
    close.focus();
    fireEvent.keyDown(close, { key: 'Tab' });
    expect(document.activeElement).toBe(screen.getByRole('combobox'));
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(close);
  });

  it('waits 120 ms after the last key and aborts the request a newer query replaces', async () => {
    const signals: AbortSignal[] = [];
    const fetchSuggestions = vi.fn((_query: string, signal: AbortSignal) => {
      signals.push(signal);
      return new Promise<Response>(() => {}); // never answers
    });
    renderVi(<CommandPalette fetchSuggestions={fetchSuggestions} />);
    press({ key: 'k', ctrlKey: true });
    const input = screen.getByRole('combobox');
    fireEvent.change(input, { target: { value: 'b' } });
    fireEvent.change(input, { target: { value: 'ba' } });
    fireEvent.change(input, { target: { value: 'bat' } });
    expect(fetchSuggestions).not.toHaveBeenCalled();
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(1));
    expect(fetchSuggestions.mock.calls[0]?.[0]).toBe('bat');
    fireEvent.change(input, { target: { value: 'bat t' } });
    expect(signals[0]?.aborted).toBe(true);
    await waitFor(() => expect(fetchSuggestions).toHaveBeenCalledTimes(2));
    expect(signals[1]?.aborted).toBe(false);
  });

  it('a failed request says so', async () => {
    renderVi(
      <CommandPalette fetchSuggestions={vi.fn(async () => new Response('{}', { status: 500 }))} />,
    );
    press({ key: 'k', ctrlKey: true });
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'binh' } });
    expect(await screen.findByText('Chưa tải được gợi ý.')).toBeTruthy();
  });

  it('the header button (mobile) opens the same palette', () => {
    renderVi(
      <>
        <SearchPaletteButton />
        <CommandPalette fetchSuggestions={vi.fn(async () => answer())} />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Mở tìm kiếm nhanh' }));
    expect(screen.getByRole('dialog', { name: 'Tìm kiếm nhanh' })).toBeTruthy();
    act(() => openCommandPalette());
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});

describe('gallery lightbox (FR-CAT-05)', () => {
  const slides = [
    { src: 'https://cdn.test/a-1280.webp', alt: 'Bìa' },
    { src: 'https://cdn.test/b-1280.webp', alt: 'Nung' },
    { src: 'https://cdn.test/c-1280.webp', alt: 'Men' },
  ];

  function gallery() {
    return renderVi(
      <ProductGallery slides={slides}>
        {slides.map((slide, index) => (
          <GalleryTrigger key={slide.src} index={index} alt={slide.alt}>
            <span>{slide.alt}</span>
          </GalleryTrigger>
        ))}
      </ProductGallery>,
    );
  }

  it('opens from the cover or any thumbnail at that photo, and closes with focus returning', () => {
    gallery();
    expect(screen.queryByRole('dialog')).toBeNull();
    const thumb = screen.getByRole('button', { name: 'Phóng to ảnh: Nung' });
    thumb.focus();
    fireEvent.click(thumb);
    const dialog = screen.getByRole('dialog', { name: 'Xem ảnh lớn' });
    expect(within(dialog).getByRole('img', { name: 'Nung' }).getAttribute('src')).toBe(
      'https://cdn.test/b-1280.webp',
    );
    expect(within(dialog).getByText('Ảnh 2 trên 3')).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement).toBe(thumb);
  });

  it('next, previous and the arrow keys walk the photos and wrap around', () => {
    gallery();
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh: Bìa' }));
    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ảnh trước' }));
    expect(within(dialog).getByRole('img', { name: 'Men' })).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Ảnh sau' }));
    expect(within(dialog).getByRole('img', { name: 'Bìa' })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(within(dialog).getByRole('img', { name: 'Nung' })).toBeTruthy();
    fireEvent.keyDown(dialog, { key: 'ArrowLeft' });
    expect(within(dialog).getByRole('img', { name: 'Bìa' })).toBeTruthy();
  });

  it('clicking the photo or the zoom button toggles zoom; changing photo resets it', () => {
    gallery();
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh: Bìa' }));
    const dialog = screen.getByRole('dialog');
    const photo = within(dialog).getByRole('img', { name: 'Bìa' });
    expect(photo.style.transform).toBe('none');
    fireEvent.click(photo);
    expect(photo.style.transform).toContain('scale(2.5)');
    expect(
      within(dialog).getByRole('button', { name: 'Thu nhỏ' }).getAttribute('aria-pressed'),
    ).toBe('true');
    fireEvent.click(photo);
    expect(photo.style.transform).toBe('none');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Phóng to' }));
    expect(photo.style.transform).toContain('scale(2.5)');
    fireEvent.keyDown(dialog, { key: 'ArrowRight' });
    expect(within(dialog).getByRole('img', { name: 'Nung' }).style.transform).toBe('none');
  });

  it('a single photo has no next or previous button', () => {
    renderVi(
      <ProductGallery slides={[{ src: 'https://cdn.test/a.webp', alt: 'Bìa' }]}>
        <GalleryTrigger index={0} alt="Bìa">
          <span>Bìa</span>
        </GalleryTrigger>
      </ProductGallery>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Phóng to ảnh: Bìa' }));
    expect(screen.queryByRole('button', { name: 'Ảnh sau' })).toBeNull();
  });

  it('builds a slide from the widest WebP of an uploaded photo, or from a licensed demo photo', () => {
    expect(
      gallerySlide({
        src: 'https://cdn.test/x.webp',
        alt: 'X',
        variants: [
          { format: 'webp', width: 640, height: 800, url: 'https://cdn.test/x-640.webp' },
          { format: 'webp', width: 1280, height: 1600, url: 'https://cdn.test/x-1280.webp' },
          { format: 'avif', width: 1920, height: 2400, url: 'https://cdn.test/x-1920.avif' },
        ],
      }),
    ).toEqual({ src: 'https://cdn.test/x-1280.webp', alt: 'X' });
    expect(gallerySlide({ src: 'https://cdn.test/y.webp', alt: 'Y' })).toEqual({
      src: 'https://cdn.test/y.webp',
      alt: 'Y',
    });
    expect(gallerySlide(undefined)).toBeUndefined();
  });
});

describe('product QR (FR-CAT-05)', () => {
  it('shows the QR of the trace short link with the link text and a PNG download', async () => {
    const url = 'https://vcraft.vn/q/ABCD2345';
    renderVi(<ProductQr code="ABCD2345" url={url} />);
    expect(screen.getByRole('heading', { name: 'Mã QR truy xuất' })).toBeTruthy();
    expect(screen.getByTestId('qr').getAttribute('data-url')).toBe(url);
    expect(screen.getByRole('link', { name: 'vcraft.vn/q/ABCD2345' }).getAttribute('href')).toBe(
      url,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tải mã QR (PNG)' }));
    await waitFor(() =>
      expect(qrDownload).toHaveBeenCalledWith({ name: 'vcraft-qr-ABCD2345', extension: 'png' }),
    );
  });
});
