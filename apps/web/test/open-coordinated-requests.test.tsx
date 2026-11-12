import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { OpenCoordinatedRequestDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { StudioOpenRequests } from '@/features/studio/studio-open-requests';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ID = '123e4567-e89b-12d3-a456-426614174000';
const OPEN: OpenCoordinatedRequestDto = {
  id: ID,
  category: 'TABLEWARE',
  quantity: 500,
  unit: 'cup',
  biddingClosesAt: '2099-12-01T00:00:00.000Z',
  requiredBy: '2100-02-01T00:00:00.000Z',
};
const asClient = (methods: object) => methods as unknown as QuotationClient;

describe('Open coordinated requests page in Studio (BR-05a, GH#490)', () => {
  it('lists the redacted open requests as the page heading and cards', async () => {
    renderVi(
      <StudioOpenRequests
        client={asClient({
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([OPEN]),
        })}
      />,
    );
    const section = await screen.findByTestId('open-requests');
    expect(
      within(section).getByRole('heading', { level: 1, name: 'Yêu cầu đang mở' }),
    ).toBeTruthy();
    expect(await within(section).findByText(/Bát đĩa: cần 500 cup/)).toBeTruthy();
    expect(within(section).getByText(/Hạn chào giá/)).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Gửi đề xuất' })).toBeTruthy();
  });

  it('explains BR-05a when no request is open', async () => {
    renderVi(
      <StudioOpenRequests
        client={asClient({
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([]),
        })}
      />,
    );
    const empty = await screen.findByTestId('open-requests-empty');
    expect(within(empty).getByText('Hiện chưa có yêu cầu mở nào phù hợp với hộ.')).toBeTruthy();
    expect(within(empty).getByText(/Ban quản lý đã nhận điều phối/)).toBeTruthy();
  });

  it('opens the offer form, sends the offer, reloads the list and points to the invitations', async () => {
    const listOpen = vi.fn().mockResolvedValueOnce([OPEN]).mockResolvedValue([]);
    const createContribution = vi.fn().mockResolvedValue({});
    renderVi(
      <StudioOpenRequests
        client={asClient({
          listOpenCoordinatedRequests: listOpen,
          createContribution,
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi đề xuất' }));
    fireEvent.change(await screen.findByLabelText('Mức tối đa (cup)'), {
      target: { value: '100' },
    });
    fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '30000' } });
    fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), { target: { value: '2100-01-01' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất' }));
    await waitFor(() =>
      expect(createContribution).toHaveBeenCalledWith(
        ID,
        {
          maxQuantity: 100,
          unitPriceVnd: 30_000,
          completionDate: expect.stringMatching(/^2100-01-01/),
        },
        { idempotencyKey: expect.any(String) },
      ),
    );
    await waitFor(() => expect(listOpen).toHaveBeenCalledTimes(2));
    const notice = await screen.findByTestId('open-requests-offered');
    expect(within(notice).getByText(/Đã gửi đề xuất/)).toBeTruthy();
    expect(within(notice).getByRole('link', { name: 'Xem lời mời báo giá' })).toBeTruthy();
  });

  it('shows an error with a retry when the open list fails', async () => {
    const listOpen = vi
      .fn()
      .mockRejectedValueOnce(new QuotationApiError('INTERNAL_ERROR', 500))
      .mockResolvedValue([OPEN]);
    renderVi(
      <StudioOpenRequests
        client={asClient({
          listOpenCoordinatedRequests: listOpen,
        })}
      />,
    );
    expect(await screen.findByText('Không tải được các yêu cầu mở.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/Bát đĩa: cần 500 cup/)).toBeTruthy();
  });

  // GH#444: claiming and offering is a state change; a retry after a lost response keeps its key.
  it('sends the offer with its target, body and the held key, reusing the key after a failure', async () => {
    const createContribution = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue({});
    renderVi(
      <StudioOpenRequests
        client={asClient({
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([OPEN]),
          createContribution,
        })}
      />,
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Gửi đề xuất' }));
    const fill = () => {
      fireEvent.change(screen.getByLabelText('Mức tối đa (cup)'), { target: { value: '100' } });
      fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '30000' } });
      fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), {
        target: { value: '2100-01-01' },
      });
    };
    fill();
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất' }));
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(1));
    await screen.findByRole('alert');
    // The panel stays open after a failure; sending again is the retry of the same offer.
    fireEvent.click(screen.getByRole('button', { name: 'Gửi đề xuất' }));
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(2));

    const body = {
      maxQuantity: 100,
      unitPriceVnd: 30_000,
      completionDate: expect.stringMatching(/^2100-01-01/),
    };
    expect(createContribution).toHaveBeenNthCalledWith(1, ID, body, {
      idempotencyKey: expect.any(String),
    });
    const first = createContribution.mock.calls[0]?.[2]?.idempotencyKey;
    expect(first).toEqual(expect.any(String));
    expect(createContribution.mock.calls[1]?.[2]?.idempotencyKey).toBe(first);
  });

  // GH#444: a failed offer for one row must not lose its key when another row is attempted meanwhile.
  it('retains a failed offer key per request while other open requests are attempted', async () => {
    const other: OpenCoordinatedRequestDto = {
      ...OPEN,
      id: '223e4567-e89b-12d3-a456-426614174000',
      category: 'TEA',
    };
    const createContribution = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockRejectedValueOnce(new TypeError('Request timed out'))
      .mockResolvedValue({});
    renderVi(
      <StudioOpenRequests
        client={asClient({
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([OPEN, other]),
          createContribution,
        })}
      />,
    );
    const fill = () => {
      fireEvent.change(screen.getByLabelText('Mức tối đa (cup)'), { target: { value: '100' } });
      fireEvent.change(screen.getByLabelText('Đơn giá (VND)'), { target: { value: '30000' } });
      fireEvent.change(screen.getByLabelText('Ngày hoàn thành'), {
        target: { value: '2100-01-01' },
      });
    };
    const cards = () =>
      within(screen.getByTestId('open-requests'))
        .getAllByRole('listitem')
        .map((item) => within(item));
    const openOffer = (index: number) =>
      cards()[index]?.getByRole('button', { name: 'Gửi đề xuất' }) as HTMLElement;
    const sendOffer = (index: number) => {
      const card = cards()[index] as ReturnType<typeof within>;
      fireEvent.click(card.getByRole('button', { name: 'Gửi đề xuất' }) as HTMLElement);
    };

    // Open the first request's offer form and make its send fail.
    await screen.findAllByRole('button', { name: 'Gửi đề xuất' });
    fireEvent.click(openOffer(0));
    fill();
    sendOffer(0);
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(1));
    const aKey = createContribution.mock.calls[0]?.[2]?.idempotencyKey;
    expect(aKey).toEqual(expect.any(String));

    // The second request gets its own form and its own failing attempt.
    fireEvent.click(openOffer(1));
    fill();
    sendOffer(1);
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(2));
    const bKey = createContribution.mock.calls[1]?.[2]?.idempotencyKey;
    expect(bKey).toEqual(expect.any(String));
    expect(bKey).not.toBe(aKey);

    // Back on the first request, its retry keeps the original key.
    fireEvent.click(openOffer(0));
    fill();
    sendOffer(0);
    await waitFor(() => expect(createContribution).toHaveBeenCalledTimes(3));
    expect(createContribution.mock.calls[2]?.[0]).toBe(OPEN.id);
    expect(createContribution.mock.calls[2]?.[2]?.idempotencyKey).toBe(aKey);
  });
});
