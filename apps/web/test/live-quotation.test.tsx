import { fireEvent, screen, waitFor } from '@testing-library/react';
import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { CoordinationDto, RfqResponse } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { LiveCoordination } from '@/features/admin/live-coordination';
import { LiveContributionWorkspace } from '@/features/rfq/live-contribution-workspace';
import { renderVi } from './render';

const id = '123e4567-e89b-12d3-a456-426614174000';
const request: RfqResponse = {
  id,
  version: 4,
  revision: 1,
  status: 'SENT',
  design: 'Logo cups',
  quantity: 5,
  unit: 'cốc',
  destination: 'Ha Noi',
  requiredBy: '2100-02-01T00:00:00.000Z',
  biddingClosesAt: '2099-12-01T00:00:00.000Z',
  invitedHouseholdIds: [id],
  coordinationOptIn: true,
};
const coordination: CoordinationDto = {
  request,
  contributions: [
    {
      id,
      version: 2,
      householdId: id,
      householdName: 'Gốm Minh Hải',
      maxQuantity: 5,
      unitPriceVnd: 30_000,
      completionDate: '2100-01-01T00:00:00.000Z',
      status: 'ACTIVE',
    },
  ],
};

describe('live quotation workspaces', () => {
  it('claims a SENT request before its first full quotation', async () => {
    const client = {
      getCoordination: vi
        .fn()
        .mockRejectedValueOnce(new QuotationApiError('NOT_FOUND', 404))
        .mockResolvedValue(coordination),
      getRequest: vi.fn().mockResolvedValue(request),
      coordinate: vi.fn().mockResolvedValue(request),
      listNotices: vi.fn().mockResolvedValue([]),
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    const claim = await screen.findByRole('button', { name: 'Nhận điều phối' });
    expect((claim as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(claim);
    await waitFor(() => expect(client.coordinate).toHaveBeenCalledWith(id, 4));
    expect(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải')).toBeTruthy();
  });

  it('submits the first quotation from SENT with current request and contribution versions', async () => {
    const client = {
      getCoordination: vi.fn().mockResolvedValue(coordination),
      listNotices: vi.fn().mockResolvedValue([]),
      submitQuotation: vi.fn().mockResolvedValue({}),
    } as unknown as QuotationClient;
    renderVi(<LiveCoordination rfqId={id} client={client} />);
    fireEvent.change(await screen.findByLabelText('Nhập số lượng cho Gốm Minh Hải'), {
      target: { value: '5' },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi chào giá liên kết' }));
    await waitFor(() =>
      expect(client.submitQuotation).toHaveBeenCalledWith(id, 4, {
        parts: [
          {
            householdId: id,
            quantity: 5,
            unitPriceVnd: 30_000,
            completionDate: '2100-01-01T00:00:00.000Z',
            contributionVersion: 2,
          },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      }),
    );
  });

  it('updates a withdrawn contribution rather than creating a duplicate', async () => {
    const offer = { ...coordination.contributions[0], status: 'WITHDRAWN', version: 7 };
    const client = {
      getRequest: vi.fn().mockResolvedValue(request),
      listOwnContributions: vi.fn().mockResolvedValue([offer]),
      updateContribution: vi.fn().mockResolvedValue({ ...offer, version: 8, status: 'ACTIVE' }),
      createContribution: vi.fn(),
    } as unknown as QuotationClient;
    renderVi(<LiveContributionWorkspace rfqId={id} client={client} />);
    const update = await screen.findByRole('button', { name: 'Cập nhật đề xuất' });
    expect((update as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(update);
    await waitFor(() =>
      expect(client.updateContribution).toHaveBeenCalledWith(id, 7, {
        maxQuantity: 5,
        unitPriceVnd: 30_000,
        completionDate: '2100-01-01T00:00:00.000Z',
      }),
    );
    expect(client.createContribution).not.toHaveBeenCalled();
  });
});
