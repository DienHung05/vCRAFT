import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { OpenCoordinatedRequestDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { QuotationInvitations } from '@/features/studio/quotation-invitations';
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

describe('Open coordinated requests in Studio (BR-05a)', () => {
  it('lists the redacted open requests below the invitations', async () => {
    renderVi(
      <QuotationInvitations
        client={asClient({
          listInvitations: vi.fn().mockResolvedValue([]),
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([OPEN]),
        })}
      />,
    );
    const section = await screen.findByTestId('open-requests');
    expect(within(section).getByText('Yêu cầu mở')).toBeTruthy();
    expect(await within(section).findByText(/Bát đĩa: cần 500 cup/)).toBeTruthy();
    expect(within(section).getByText(/Hạn chào giá/)).toBeTruthy();
    expect(within(section).getByRole('button', { name: 'Gửi đề xuất' })).toBeTruthy();
  });

  it('explains BR-05a when no request is open', async () => {
    renderVi(
      <QuotationInvitations
        client={asClient({
          listInvitations: vi.fn().mockResolvedValue([]),
          listOpenCoordinatedRequests: vi.fn().mockResolvedValue([]),
        })}
      />,
    );
    const empty = await screen.findByTestId('open-requests-empty');
    expect(within(empty).getByText('Hiện chưa có yêu cầu mở nào phù hợp với hộ.')).toBeTruthy();
    expect(within(empty).getByText(/Ban quản lý đã nhận điều phối/)).toBeTruthy();
  });

  it('opens the offer form, sends the offer and reloads both lists', async () => {
    const listOpen = vi.fn().mockResolvedValueOnce([OPEN]).mockResolvedValue([]);
    const listInvitations = vi.fn().mockResolvedValue([]);
    const createContribution = vi.fn().mockResolvedValue({});
    renderVi(
      <QuotationInvitations
        client={asClient({
          listInvitations,
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
      expect(createContribution).toHaveBeenCalledWith(ID, {
        maxQuantity: 100,
        unitPriceVnd: 30_000,
        completionDate: expect.stringMatching(/^2100-01-01/),
      }),
    );
    await waitFor(() => expect(listInvitations).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(listOpen).toHaveBeenCalledTimes(2));
  });

  it('keeps the invitations usable when the open list fails, with its own retry', async () => {
    const listOpen = vi
      .fn()
      .mockRejectedValueOnce(new QuotationApiError('INTERNAL_ERROR', 500))
      .mockResolvedValue([OPEN]);
    renderVi(
      <QuotationInvitations
        client={asClient({
          listInvitations: vi.fn().mockResolvedValue([]),
          listOpenCoordinatedRequests: listOpen,
        })}
      />,
    );
    expect(await screen.findByText('Không tải được các yêu cầu mở.')).toBeTruthy();
    expect(screen.getByText('Hộ chưa có lời mời nào.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Thử lại' }));
    expect(await screen.findByText(/Bát đĩa: cần 500 cup/)).toBeTruthy();
  });
});
