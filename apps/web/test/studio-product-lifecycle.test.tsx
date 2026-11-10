import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { StudioClient } from '@vcraft/api-client';
import type { HouseholdDto, ProductCardDto, ProductDto } from '@vcraft/contracts';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProductCard } from '@/features/catalog/product-card';
import { toProductCardView } from '@/features/catalog/view-models';
import { ProductEditor, toProductUpdate } from '@/features/studio/product-editor';
import { EMPTY_PRODUCT, parseNewProduct } from '@/features/studio/product-fields';
import { ProductList } from '@/features/studio/product-list';
import { TagInput, tagSuggestions } from '@/features/studio/tag-input';
import { confirmDialog } from './confirm';
import { renderEn, renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  usePathname: () => '/studio/san-pham',
  useRouter: () => ({ push }),
}));
vi.mock('@/features/traceability/trace-qr', () => ({
  TraceQr: () => <div data-testid="qr" />,
  QR_LOGO_URL: '/brand/icon-512.png',
  QR_LOGO_OPTIONS: { margin: 4, hideBackgroundDots: true, imageSize: 0.3 },
}));
vi.mock('qr-code-styling', () => ({ default: class {} }));

const ID = '00000000-0000-4000-8000-00000000000';

function product(n: number, overrides: Partial<ProductDto> = {}): ProductDto {
  return {
    id: `${ID}${n}`,
    version: 2,
    name: `Món ${n}`,
    nameEn: null,
    slug: `mon-${n}`,
    traceCode: `CODE000${n}`,
    description: '',
    descriptionEn: null,
    kind: 'OBJECT',
    batchSize: null,
    category: 'VASE',
    priceVnd: 100_000,
    stock: 1,
    material: null,
    dimensions: null,
    materialEn: null,
    dimensionsEn: null,
    weightGrams: null,
    artisanNote: null,
    tags: [],
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    coverAltEn: null,
    images: [],
    status: 'PUBLISHED',
    publishedAt: '2026-09-01T00:00:00.000Z',
    withdrawnBy: null,
    withdrawnReason: null,
    makers: [],
    postedBy: 'HOUSEHOLD_ADMINISTRATION',
    ...overrides,
  };
}

const HOUSEHOLD = {
  id: `${ID}9`,
  version: 1,
  name: 'Hộ',
  nameEn: null,
  slug: 'ho',
  status: 'APPROVED',
  artisans: [],
  products: [
    product(1, { tags: ['Gốm Bát Tràng', 'men lam'] }),
    product(2, { kind: 'BATCH', batchSize: 20 }),
    product(3, { status: 'SOLD', stock: 0 }),
    product(4, { status: 'WITHDRAWN' }),
  ],
} as unknown as HouseholdDto;

function client(overrides: Partial<StudioClient> = {}): StudioClient {
  return {
    getHousehold: vi.fn(async () => HOUSEHOLD),
    getScanStats: vi.fn(async () => ({
      total: 0,
      last30Days: 0,
      daily: [],
      byCountry: [],
      byDeviceType: [],
    })),
    getPriceSuggestion: vi.fn(async () => ({ category: 'VASE', suggestion: null })),
    markProductSold: vi.fn(async () => product(1, { status: 'SOLD' })),
    productBackOnSale: vi.fn(async () => product(3)),
    duplicateProduct: vi.fn(async () => product(5, { status: 'DRAFT' })),
    updateProduct: vi.fn(async () => product(1)),
    ...overrides,
  } as unknown as StudioClient;
}

function ControlledTags({ initial = [] as string[], suggestions = [] as string[] }) {
  const [tags, setTags] = useState(initial);
  return <TagInput value={tags} onChange={setTags} suggestions={suggestions} />;
}

describe('TagInput', () => {
  const input = () => screen.getByLabelText('Thẻ') as HTMLInputElement;

  it('adds a chip on Enter or a comma and keeps the diacritics as typed', () => {
    renderVi(<ControlledTags />);
    fireEvent.change(input(), { target: { value: '  Gốm Bát Tràng ' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    fireEvent.change(input(), { target: { value: 'men lam,' } });
    const chips = within(screen.getByRole('list', { name: 'Thẻ đã chọn' })).getAllByRole(
      'listitem',
    );
    expect(chips.map((chip) => chip.textContent)).toEqual(['Gốm Bát Tràng×', 'men lam×']);
  });

  it('does not add a tag that differs only by case', () => {
    renderVi(<ControlledTags initial={['Men Lam']} />);
    fireEvent.change(input(), { target: { value: 'men lam' } });
    fireEvent.keyDown(input(), { key: 'Enter' });
    expect(
      within(screen.getByRole('list', { name: 'Thẻ đã chọn' })).getAllByRole('listitem'),
    ).toHaveLength(1);
  });

  it('removes a chip with its button and with Backspace on an empty field', () => {
    renderVi(<ControlledTags initial={['a', 'b', 'c']} />);
    fireEvent.click(screen.getByRole('button', { name: 'Xóa thẻ b' }));
    fireEvent.keyDown(input(), { key: 'Backspace' });
    const chips = within(screen.getByRole('list', { name: 'Thẻ đã chọn' })).getAllByRole(
      'listitem',
    );
    expect(chips.map((chip) => chip.textContent)).toEqual(['a×']);
  });

  it('stops at 10 tags and limits one tag to 30 characters', () => {
    const ten = Array.from({ length: 10 }, (_, i) => `thẻ ${i}`);
    renderVi(<ControlledTags initial={ten} />);
    expect(input().disabled).toBe(true);
    expect(screen.getByText(/Đã đủ 10 thẻ/)).toBeTruthy();
    expect(input().maxLength).toBe(30);
  });

  it('offers the household tags as suggestions and adds one on click', () => {
    renderVi(<ControlledTags initial={['men lam']} suggestions={['Men Lam', 'sơn mài', 'gốm']} />);
    expect(screen.queryByRole('button', { name: '+ Men Lam' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '+ sơn mài' }));
    expect(screen.queryByRole('button', { name: '+ sơn mài' })).toBeNull();
    const chips = within(screen.getByRole('list', { name: 'Thẻ đã chọn' })).getAllByRole(
      'listitem',
    );
    expect(chips.map((chip) => chip.textContent)).toEqual(['men lam×', 'sơn mài×']);
  });

  it('collects every distinct tag of the other products, minus the chosen ones', () => {
    expect(
      tagSuggestions(
        [
          ['Gốm', 'men lam'],
          ['GỐM', 'sơn mài'],
        ],
        ['Men Lam'],
      ),
    ).toEqual(['Gốm', 'sơn mài']);
  });
});

describe('tags in the product forms', () => {
  it('sends the tags with a new product and with an update', () => {
    const draft = { ...EMPTY_PRODUCT, name: 'Bình', tags: ['men lam', 'thủ công'] };
    expect(parseNewProduct(draft).data).toMatchObject({ tags: ['men lam', 'thủ công'] });
    expect(toProductUpdate(draft)).toMatchObject({ tags: ['men lam', 'thủ công'] });
    expect(
      parseNewProduct({ ...draft, tags: Array.from({ length: 11 }, (_, i) => `t${i}`) }).success,
    ).toBe(false);
  });

  it('edits the tags of a product in the editor and saves them', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    const details = (await screen.findByRole('heading', { name: 'Thông tin' }))
      .parentElement as HTMLElement;
    fireEvent.change(within(details).getByLabelText('Thẻ'), { target: { value: 'sơn mài' } });
    fireEvent.keyDown(within(details).getByLabelText('Thẻ'), { key: 'Enter' });
    fireEvent.click(within(details).getByRole('button', { name: 'Lưu' }));
    await waitFor(() =>
      expect(api.updateProduct).toHaveBeenCalledWith(
        `${ID}1`,
        2,
        expect.objectContaining({ tags: ['Gốm Bát Tràng', 'men lam', 'sơn mài'] }),
      ),
    );
  });
});

describe('sold state in the studio', () => {
  beforeEach(() => push.mockClear());

  it('marks a published one-of-a-kind product as sold after confirming', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đánh dấu đã bán' }));
    expect(api.markProductSold).not.toHaveBeenCalled();
    confirmDialog('Đánh dấu đã bán');
    await waitFor(() => expect(api.markProductSold).toHaveBeenCalledWith(`${ID}1`, 2));
  });

  it('offers no "mark as sold" for a production batch', async () => {
    renderVi(<ProductEditor productId={`${ID}2`} client={client()} />);
    await screen.findByRole('button', { name: 'Lưu trữ' });
    expect(screen.queryByRole('button', { name: 'Đánh dấu đã bán' })).toBeNull();
  });

  it('puts a sold product back on sale', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}3`} client={api} />);
    expect(await screen.findByText(/Sản phẩm này đã bán/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Đánh dấu đã bán' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Mở bán lại' }));
    confirmDialog('Mở bán lại');
    await waitFor(() => expect(api.productBackOnSale).toHaveBeenCalledWith(`${ID}3`, 2));
  });

  it('lists the sold and archived states in the product filter', async () => {
    renderVi(<ProductList client={client()} />);
    fireEvent.click(await screen.findByRole('radio', { name: 'Đã bán' }));
    const list = screen.getByTestId('studio-products');
    expect(within(list).getAllByRole('listitem')).toHaveLength(1);
    expect(within(list).getByText('Món 3')).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Lưu trữ' })).toBeTruthy();
  });

  it('labels the withdrawn state "Archived" in English', async () => {
    renderEn(<ProductList client={client()} />);
    expect(await screen.findByRole('radio', { name: 'Archived' })).toBeTruthy();
    expect(screen.getByRole('radio', { name: 'Sold' })).toBeTruthy();
  });
});

describe('sold badge in the catalog', () => {
  const card = (status: ProductCardDto['status']): ProductCardDto => ({
    id: 'a',
    name: 'Bình độc bản',
    nameEn: null,
    slug: 'binh-doc-ban',
    traceCode: 'CODEAAAA',
    kind: 'OBJECT',
    category: 'VASE',
    priceVnd: 100_000,
    stock: 0,
    status,
    tags: [],
    coverUrl: null,
    coverVariants: [],
    coverAlt: null,
    coverAltEn: null,
    publishedAt: null,
    household: { name: 'Hộ A', slug: 'ho-a' },
  });

  it('shows "Đã bán" on a sold card and nothing on a published one', () => {
    const sold = renderVi(<ProductCard product={toProductCardView(card('SOLD'))} />);
    expect(screen.getByText('Đã bán')).toBeTruthy();
    sold.unmount();
    renderVi(<ProductCard product={toProductCardView(card('PUBLISHED'))} />);
    expect(screen.queryByText('Đã bán')).toBeNull();
  });
});

describe('duplicate product', () => {
  beforeEach(() => push.mockClear());

  it('creates a draft copy and opens it in the editor', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân bản' }));
    await waitFor(() =>
      expect(api.duplicateProduct).toHaveBeenCalledWith(`${ID}1`, {
        idempotencyKey: expect.any(String),
      }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith({
        pathname: '/studio/san-pham/[id]',
        params: { id: `${ID}5` },
      }),
    );
  });

  it('tells the household when the copy failed and stays on the page', async () => {
    const api = client({
      duplicateProduct: vi.fn(async () => {
        throw new Error('boom');
      }),
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Nhân bản' }));
    expect(await screen.findByText(/Chưa nhân bản được sản phẩm/)).toBeTruthy();
    expect(push).not.toHaveBeenCalled();
  });
});

describe('price suggestion hint', () => {
  it('shows the median with its sample size and fills the price only on request', async () => {
    const api = client({
      getPriceSuggestion: vi.fn(async () => ({
        category: 'VASE' as const,
        suggestion: { medianVnd: 250_000, count: 5 },
      })),
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    const hint = await screen.findByTestId('price-suggestion');
    expect(api.getPriceSuggestion).toHaveBeenCalledWith('VASE');
    expect(hint.textContent).toMatch(/250\.000/);
    expect(hint.textContent).toMatch(/5 sản phẩm/);
    const price = screen.getByLabelText(/Giá bán/) as HTMLInputElement;
    expect(price.value).toBe('100000');
    fireEvent.click(within(hint).getByRole('button', { name: 'Dùng giá này' }));
    expect(price.value).toBe('250000');
    expect(api.updateProduct).not.toHaveBeenCalled();
  });

  it('is hidden when the API has too few comparable products', async () => {
    const api = client();
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    await screen.findByRole('heading', { name: 'Thông tin' });
    await act(async () => {});
    expect(api.getPriceSuggestion).toHaveBeenCalled();
    expect(screen.queryByTestId('price-suggestion')).toBeNull();
  });

  it('is hidden when the request fails, and the price stays editable', async () => {
    const api = client({
      getPriceSuggestion: vi.fn(async () => {
        throw new Error('offline');
      }),
    });
    renderVi(<ProductEditor productId={`${ID}1`} client={api} />);
    await screen.findByRole('heading', { name: 'Thông tin' });
    await act(async () => {});
    expect(screen.queryByTestId('price-suggestion')).toBeNull();
    expect(screen.getByLabelText(/Giá bán/)).toBeTruthy();
  });
});
