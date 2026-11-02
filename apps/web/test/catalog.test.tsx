import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import type { JournalDto, ProductCardDto } from '@vcraft/contracts';
import { sealChain, verifyChain } from '@vcraft/domain';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogExplorer } from '@/features/catalog/catalog-explorer';
import {
  catalogSearchParams,
  EMPTY_FILTERS,
  parseCatalogParams,
  toProductFilters,
} from '@/features/catalog/catalog-filters';
import { productsQueryString } from '@/features/catalog/exhibition-query';
import { ProductCard } from '@/features/catalog/product-card';
import {
  photoFromUrl,
  projectPins,
  tintOf,
  toLogEntries,
  toProductCardView,
} from '@/features/catalog/view-models';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <a href="/x" className={className}>
      {children}
    </a>
  ),
}));

function card(id: string, overrides: Partial<ProductCardDto> = {}): ProductCardDto {
  return {
    id,
    name: `Món ${id}`,
    slug: `mon-${id}`,
    traceCode: `CODE${id}`,
    kind: 'BATCH',
    category: 'VASE',
    priceVnd: 100_000,
    stock: 3,
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    coverAltEn: null,
    publishedAt: null,
    household: { name: 'Hộ A', slug: 'ho-a' },
    ...overrides,
  };
}

const page = (ids: string[], nextCursor: string | null) =>
  new Response(JSON.stringify({ data: ids.map((id) => card(id)), nextCursor }));

describe('bộ lọc trên URL (FR-CAT-02)', () => {
  it('đọc rồi ghi lại đúng, bỏ giá trị lạ và mặc định', () => {
    const filters = parseCatalogParams({
      q: 'bat trang',
      category: 'TEA',
      minPrice: '100000',
      maxPrice: 'abc',
      oneOfAKind: '1',
      sort: 'price_asc',
    });
    expect(filters).toMatchObject({ category: 'TEA', minPrice: '100000', maxPrice: '' });
    expect(catalogSearchParams(filters).toString()).toBe(
      'q=bat+trang&category=TEA&minPrice=100000&oneOfAKind=1&sort=price_asc',
    );
    expect(parseCatalogParams({ category: 'KHONG', sort: 'x' })).toEqual(EMPTY_FILTERS);
    expect(catalogSearchParams(EMPTY_FILTERS).toString()).toBe('');
  });

  it('đổi sang tham số API', () => {
    const query = toProductFilters({ ...EMPTY_FILTERS, inStock: true, maxPrice: '5' });
    expect(productsQueryString(query)).toBe('sort=newest&maxPrice=5&inStock=true');
  });
});

describe('view models', () => {
  it('ảnh có giấy phép giữ tham chiếu ghi công; URL khác dùng trực tiếp', () => {
    expect(photoFromUrl('/images/demo/binh-men-lam-xam-1280.webp', 'Bình')?.photo?.id).toBe(
      'binh-men-lam-xam',
    );
    expect(photoFromUrl('https://cdn/x.webp', 'X')).toEqual({
      src: 'https://cdn/x.webp',
      alt: 'X',
    });
    expect(photoFromUrl(null, 'X')).toBeUndefined();
  });

  it('a product without a photo shows a labelled illustration of its own kind, never a stand-in photo', () => {
    const bowl = toProductCardView(card('1', { name: 'Bát ăn cơm vẽ sen', category: 'TABLEWARE' }));
    expect(bowl.presetKind).toBe('bowl');
    const { container } = renderVi(<ProductCard product={bowl} />);
    expect(
      screen.getByRole('img', { name: /Hình minh hoạ chiếc bát.*chưa có ảnh thật/ }),
    ).toBeTruthy();
    expect(container.querySelector('img')).toBeNull();
  });

  it('shows the English description of a cover on /en and the Vietnamese one on /vi', () => {
    const dto = card('2', {
      coverUrl: 'https://cdn.test/a.webp',
      coverAlt: 'Cái bình',
      coverAltEn: 'A vase',
    });
    expect(toProductCardView(dto, 'en').image?.alt).toBe('A vase');
    expect(toProductCardView(dto, 'vi').image?.alt).toBe('Cái bình');
    expect(toProductCardView({ ...dto, coverAltEn: null }, 'en').image?.alt).toBe('Cái bình');
  });

  it('độc bản theo loại, màu ổn định theo mã', () => {
    expect(toProductCardView(card('1', { kind: 'OBJECT' })).oneOfAKind).toBe(true);
    expect(tintOf('ABC')).toBe(tintOf('ABC'));
  });

  it('keeps the real images and credits the API returns on journal entries', () => {
    const image = {
      url: 'https://cdn.test/nung.webp',
      variants: [],
      sha256: 'a'.repeat(64),
      credit: {
        title: 'File:Nung.jpg',
        author: 'Tác giả ảnh',
        license: 'CC0',
        licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
        sourceUrl: 'https://commons.wikimedia.org/wiki/File:Nung.jpg',
      },
    };
    const [entry] = toLogEntries({
      productId: '00000000-0000-4000-8000-000000000001',
      inProgress: false,
      missingStages: [],
      entries: [
        {
          id: '00000000-0000-4000-8000-000000000002',
          version: 1,
          seq: 0,
          stage: 'fire',
          declaredDate: '2026-09-01',
          note: 'Nung',
          images: [image],
          skipReason: null,
          supersedesSeq: null,
          supersededBySeq: null,
          recordedAt: '2026-09-01T00:00:00.000Z',
          prevHash: 'GENESIS',
          hash: 'b'.repeat(64),
        },
      ],
    });
    expect(entry?.images).toEqual([image]);
    expect(entry?.mediaChecksums).toEqual([image.sha256]);
  });

  it('nhật ký của API qua được bước tự kiểm chuỗi băm của trình duyệt', async () => {
    const productId = '00000000-0000-4000-8000-000000000001';
    const sealed = await sealChain(productId, [
      { stage: 'clay', at: '2026-09-01', note: 'Nhào đất', mediaChecksums: [] },
      { stage: 'throw', at: '2026-09-03', note: 'Vuốt', mediaChecksums: [] },
    ]);
    const journal = {
      productId,
      inProgress: false,
      missingStages: [],
      entries: sealed.map((e) => ({
        id: '00000000-0000-4000-8000-000000000002',
        version: 1,
        seq: e.seq,
        stage: e.stage,
        declaredDate: e.at,
        note: e.note,
        images: [],
        skipReason: null,
        supersedesSeq: null,
        supersededBySeq: null,
        recordedAt: '2026-09-01T00:00:00.000Z',
        prevHash: e.prevHash,
        hash: e.hash,
      })),
    } as JournalDto;
    await expect(verifyChain(productId, toLogEntries(journal))).resolves.toEqual({
      ok: true,
      count: 2,
    });
  });

  it('chiếu tọa độ vào khung, điểm thiếu tọa độ nằm giữa', () => {
    const pins = projectPins([
      { id: 'a', lat: 20, lng: 105 },
      { id: 'b', lat: 21, lng: 106 },
      { id: 'c', lat: null, lng: null },
    ]);
    expect(pins.get('a')).toEqual({ x: 14, y: 86 });
    expect(pins.get('b')).toEqual({ x: 86, y: 14 });
    expect(pins.get('c')).toEqual({ x: 50, y: 50 });
  });
});

describe('CatalogExplorer', () => {
  const props = {
    initialFilters: EMPTY_FILTERS,
    initialCursor: null,
    households: [],
  };

  beforeEach(() => window.history.replaceState(null, '', '/vi/san-pham'));

  it('đổi bộ lọc: cập nhật URL, hiện skeleton, thay danh sách bằng JSON', async () => {
    let resolve: (value: Response) => void = () => {};
    const fetchProducts = vi.fn(
      () =>
        new Promise<Response>((r) => {
          resolve = r;
        }),
    );
    renderVi(
      <CatalogExplorer {...props} initialItems={[card('1')]} fetchProducts={fetchProducts} />,
    );
    fireEvent.click(screen.getByRole('checkbox', { name: 'Còn hàng' }));
    expect(window.location.search).toBe('?inStock=1');
    await waitFor(() => expect(fetchProducts).toHaveBeenCalled());
    expect(fetchProducts.mock.calls[0]?.[0 as never]).toContain('inStock=true');
    expect(screen.getByTestId('product-skeleton')).toBeTruthy();
    await act(async () => resolve(page(['2'], null)));
    expect(await screen.findByText('Món 2')).toBeTruthy();
    expect(screen.queryByText('Món 1')).toBeNull();
  });

  it('tải thêm nối vào cuối bằng con trỏ, hết trang thì ẩn nút', async () => {
    const fetchProducts = vi.fn(async () => page(['2'], null));
    renderVi(
      <CatalogExplorer
        {...props}
        initialItems={[card('1')]}
        initialCursor="c1"
        fetchProducts={fetchProducts}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Tải thêm' }));
    expect(await screen.findByText('Món 2')).toBeTruthy();
    expect(screen.getByText('Món 1')).toBeTruthy();
    expect(fetchProducts.mock.calls[0]?.[0 as never]).toContain('cursor=c1');
    expect(screen.queryByRole('button', { name: 'Tải thêm' })).toBeNull();
  });

  it('lỗi có nút thử lại; thử lại thành công thì hết lỗi', async () => {
    const fetchProducts = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 500 }))
      .mockResolvedValueOnce(page(['3'], null));
    renderVi(<CatalogExplorer {...props} initialItems={[]} fetchProducts={fetchProducts} />);
    fireEvent.click(screen.getByRole('checkbox', { name: 'Độc bản' }));
    expect(await screen.findByRole('alert')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText('Món 3')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('không có kết quả thì hiện trạng thái trống', () => {
    renderVi(<CatalogExplorer {...props} initialItems={[]} />);
    expect(screen.getByText('Không có sản phẩm nào khớp bộ lọc.')).toBeTruthy();
  });
});
