import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { type AdminClient, ApiError } from '@vcraft/api-client';
import type { HouseholdDto, ProductDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { HouseholdReview } from '@/features/admin/household-review';
import { confirmDialog, openDialog } from './confirm';
import { renderVi } from './render';

vi.mock('next/dynamic', () => ({ default: () => () => null }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));
vi.mock('@/lib/notify', () => ({
  notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

const ID = '00000000-0000-4000-8000-000000000001';

function product(over: Partial<ProductDto>): ProductDto {
  return {
    id: `${ID}p`,
    version: 3,
    name: 'Bình men lam',
    status: 'PUBLISHED',
    withdrawnBy: null,
    withdrawnReason: null,
    ...over,
  } as unknown as ProductDto;
}

const PUBLISHED = product({ id: `${ID}1`, name: 'Bình đang bán' });
const BOARD = product({
  id: `${ID}2`,
  name: 'Bình bị gỡ',
  status: 'WITHDRAWN',
  withdrawnBy: 'BOARD',
  withdrawnReason: 'Sai mô tả',
  version: 7,
});
const OWNER = product({
  id: `${ID}3`,
  name: 'Bình hộ lưu trữ',
  status: 'WITHDRAWN',
  withdrawnBy: 'OWNER',
});

function household(products: ProductDto[]): HouseholdDto {
  return {
    id: ID,
    version: 4,
    name: 'Gốm Bảo Châu',
    slug: 'gom-bao-chau',
    history: 'Hồ sơ khai.',
    village: 'Bát Tràng',
    craft: null,
    craftCategory: null,
    certifications: [],
    foundedYear: null,
    artisans: [],
    workshops: [],
    products,
    status: 'APPROVED',
    statusReason: null,
    approvedAt: null,
    idNumberMasked: null,
  } as unknown as HouseholdDto;
}

function client(products: ProductDto[], overrides: Partial<AdminClient> = {}): AdminClient {
  return {
    getHousehold: vi.fn(async () => household(products)),
    documents: vi.fn(async () => ({ data: [] })),
    withdrawProduct: vi.fn(async (_id: string, version: number) =>
      product({
        id: PUBLISHED.id,
        status: 'WITHDRAWN',
        withdrawnBy: 'BOARD',
        version: version + 1,
      }),
    ),
    republishProduct: vi.fn(async (_id: string, version: number) =>
      product({ id: BOARD.id, name: BOARD.name, version: version + 1 }),
    ),
    ...overrides,
  } as unknown as AdminClient;
}

describe('HouseholdReview products', () => {
  it('lists each product with its status and who withdrew it', async () => {
    renderVi(<HouseholdReview householdId={ID} client={client([PUBLISHED, BOARD, OWNER])} />);
    const section = await screen.findByTestId('review-products');
    expect(within(section).getByText('Bình đang bán')).toBeTruthy();
    expect(within(section).getByText(/Ban quản lý đã gỡ · Lý do: Sai mô tả/)).toBeTruthy();
    expect(within(section).getByText('Hộ tự lưu trữ')).toBeTruthy();
    // Withdraw only for live products; republish only for what the board withdrew.
    expect(within(section).getAllByRole('button', { name: /^Gỡ sản phẩm “/ })).toHaveLength(1);
    expect(within(section).getAllByRole('button', { name: /^Đưa lại sản phẩm “/ })).toHaveLength(1);
  });

  it('says so when the household has no products', async () => {
    renderVi(<HouseholdReview householdId={ID} client={client([])} />);
    expect(await screen.findByText('Hộ chưa có sản phẩm.')).toBeTruthy();
  });

  it('withdraws after a confirmation that requires a reason, sending the product version', async () => {
    const api = client([PUBLISHED]);
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ sản phẩm “Bình đang bán”' }));
    const confirm = within(openDialog()).getByRole('button', {
      name: 'Gỡ sản phẩm',
      hidden: true,
    });
    expect((confirm as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(within(openDialog()).getByLabelText('Lý do'), {
      target: { value: 'Sai mô tả' },
    });
    confirmDialog('Gỡ sản phẩm');
    await waitFor(() =>
      expect(api.withdrawProduct).toHaveBeenCalledWith(PUBLISHED.id, 3, 'Sai mô tả'),
    );
    expect(await screen.findByText(/Ban quản lý đã gỡ/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /^Gỡ sản phẩm “/ })).toBeNull();
  });

  it('republishes a board-withdrawn product after confirmation', async () => {
    const api = client([BOARD]);
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Đưa lại sản phẩm “Bình bị gỡ”' }));
    confirmDialog('Đưa lại');
    await waitFor(() => expect(api.republishProduct).toHaveBeenCalledWith(BOARD.id, 7));
    expect(await screen.findByRole('button', { name: 'Gỡ sản phẩm “Bình bị gỡ”' })).toBeTruthy();
  });

  it('reloads the household and warns when the product version is stale', async () => {
    const withdrawProduct = vi.fn(async () => {
      throw new ApiError('STALE_VERSION', 409);
    });
    const api = client([PUBLISHED], { withdrawProduct } as unknown as Partial<AdminClient>);
    renderVi(<HouseholdReview householdId={ID} client={api} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ sản phẩm “Bình đang bán”' }));
    fireEvent.change(within(openDialog()).getByLabelText('Lý do'), {
      target: { value: 'Sai mô tả' },
    });
    confirmDialog('Gỡ sản phẩm');
    expect(await screen.findByText(/Sản phẩm vừa thay đổi/)).toBeTruthy();
    expect(api.getHousehold).toHaveBeenCalledTimes(2);
  });
});
