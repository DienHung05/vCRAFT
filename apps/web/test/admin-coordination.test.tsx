import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AdminClient } from '@vcraft/api-client';
import type { AuditEntryDto, CoordinationQueueItemDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AuditLogView } from '@/features/admin/audit-log';
import { CoordinationQueue } from '@/features/admin/coordination-queue';
import { renderVi } from './render';

vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const ROW: CoordinationQueueItemDto = {
  id: '00000000-0000-4000-8000-000000000001',
  version: 3,
  status: 'SENT',
  design: '5000 printed cups',
  quantity: 5000,
  unit: 'cup',
  requiredBy: '2027-03-01T00:00:00.000Z',
  biddingClosesAt: '2027-02-01T00:00:00.000Z',
  buyerName: 'University',
  contributionCount: 2,
  coordinatorName: null,
  claimed: false,
  claimedByMe: false,
};

const ENTRY: AuditEntryDto = {
  id: '00000000-0000-4000-8000-000000000002',
  actorId: '00000000-0000-4000-8000-000000000003',
  actorName: 'Admin One',
  action: 'household.reject',
  entity: 'household',
  entityId: '00000000-0000-4000-8000-000000000004',
  targetLabel: 'Gốm Hồng',
  before: { status: 'PENDING_REVIEW' },
  after: { status: 'REJECTED', reason: 'Missing documents' },
  createdAt: '2026-10-30T03:00:00.000Z',
};

/** A legacy entry: no snapshot label and no resolvable row — the kind plus the id remain. */
const LEGACY: AuditEntryDto = {
  ...ENTRY,
  id: '00000000-0000-4000-8000-000000000006',
  actorName: null,
  action: 'news.delete',
  entity: 'news',
  entityId: '00000000-0000-4000-8000-000000000007',
  targetLabel: null,
  before: null,
  after: null,
};

const asClient = (methods: Partial<AdminClient>) => methods as unknown as AdminClient;

describe('CoordinationQueue', () => {
  it('marks a request made for an off-platform customer and shows the customer', async () => {
    const coordinationQueue = vi.fn().mockResolvedValue([
      ROW,
      {
        ...ROW,
        id: '00000000-0000-4000-8000-000000000009',
        buyerName: 'Nguyen Van An',
        onBehalfOf: { name: 'Nguyen Van An', phone: '0912345678' },
      },
    ]);
    renderVi(<CoordinationQueue client={asClient({ coordinationQueue })} />);

    expect(await screen.findByText('Nguyen Van An')).toBeTruthy();
    expect(screen.getByText('0912345678')).toBeTruthy();
    // Only the customer's request carries the badge.
    expect(screen.getAllByText('Khách ngoài nền tảng')).toHaveLength(1);
    expect(screen.getByRole('link', { name: 'Tạo yêu cầu cho khách hàng' })).toBeTruthy();
  });

  it('claims an unclaimed request with its current version, then reloads', async () => {
    const coordinationQueue = vi
      .fn()
      .mockResolvedValueOnce([ROW])
      .mockResolvedValue([{ ...ROW, claimed: true, claimedByMe: true, version: 4 }]);
    const claimCoordination = vi.fn().mockResolvedValue({});
    renderVi(<CoordinationQueue client={asClient({ coordinationQueue, claimCoordination })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nhận điều phối' }));
    await waitFor(() => expect(claimCoordination).toHaveBeenCalledWith(ROW.id, 3));
    expect(await screen.findByText('Bạn đang phụ trách')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nhận điều phối' })).toBeNull();
  });

  it('offers no claim on a request another admin holds', async () => {
    const coordinationQueue = vi
      .fn()
      .mockResolvedValue([{ ...ROW, claimed: true, coordinatorName: 'Admin Two' }]);
    renderVi(<CoordinationQueue client={asClient({ coordinationQueue })} />);

    expect(await screen.findByText('Admin Two đang phụ trách')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Nhận điều phối' })).toBeNull();
    expect(screen.queryByRole('link', { name: 'Mở' })).toBeNull();
  });

  it('says so and refreshes when a claim loses the race', async () => {
    const coordinationQueue = vi.fn().mockResolvedValue([ROW]);
    const claimCoordination = vi.fn().mockRejectedValue(new Error('gone'));
    renderVi(<CoordinationQueue client={asClient({ coordinationQueue, claimCoordination })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Nhận điều phối' }));
    expect((await screen.findByRole('alert')).textContent).toContain('vừa có người nhận');
    expect(coordinationQueue).toHaveBeenCalledTimes(2);
  });
});

describe('AuditLogView', () => {
  it('shows who, what, when, target and before/after, and passes filters to the API', async () => {
    const auditLog = vi.fn().mockResolvedValue({ data: [ENTRY, LEGACY], nextCursor: null });
    const auditActors = vi.fn().mockResolvedValue([{ id: ENTRY.actorId, name: 'Admin One' }]);
    renderVi(<AuditLogView client={asClient({ auditLog, auditActors })} />);

    const table = await screen.findByTestId('audit-log');
    expect(within(table).getByText('Admin One')).toBeTruthy();
    expect(within(table).getByText('Từ chối hộ')).toBeTruthy();
    expect(within(table).getByText('Gốm Hồng')).toBeTruthy();
    expect(within(table).getByText(ENTRY.entityId)).toBeTruthy();
    expect(within(table).getByText('PENDING_REVIEW')).toBeTruthy();
    expect(within(table).getByText('Missing documents')).toBeTruthy();
    // A legacy entry without a label keeps the localized kind above the stable id, and the deleted
    // actor's name is gone.
    expect(within(table).getByText('Tài khoản không còn tồn tại')).toBeTruthy();
    expect(within(table).getByText('Tin tức')).toBeTruthy();
    expect(within(table).getByText(LEGACY.entityId)).toBeTruthy();

    // GH#393: filters never grow wider than the page (long English action labels overflowed 360 px).
    expect(screen.getByLabelText('Hành động').className).toContain('max-w-full');
    fireEvent.change(screen.getByLabelText('Hành động'), { target: { value: 'rfq.claim' } });
    await waitFor(() =>
      expect(auditLog).toHaveBeenLastCalledWith(expect.objectContaining({ action: 'rfq.claim' })),
    );
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    await waitFor(() =>
      expect(auditLog).toHaveBeenLastCalledWith(
        expect.objectContaining({ action: 'rfq.claim', from: '2026-10-01' }),
      ),
    );
  });

  it('loads the next page with the server cursor and keeps earlier rows', async () => {
    const auditLog = vi
      .fn()
      .mockResolvedValueOnce({ data: [ENTRY], nextCursor: 'abc' })
      .mockResolvedValue({
        data: [{ ...ENTRY, id: '00000000-0000-4000-8000-000000000005', actorName: 'Admin Two' }],
        nextCursor: null,
      });
    const auditActors = vi.fn().mockResolvedValue([]);
    renderVi(<AuditLogView client={asClient({ auditLog, auditActors })} />);

    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    expect(await screen.findByText('Admin Two')).toBeTruthy();
    expect(screen.getByText('Admin One')).toBeTruthy();
    expect(auditLog).toHaveBeenLastCalledWith(expect.objectContaining({ cursor: 'abc' }));
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).toBeNull();
  });
});
