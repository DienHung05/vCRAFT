import { act, fireEvent, screen, waitFor, within } from '@testing-library/react';
import type { AdminClient, PaymentClient, QuotationClient } from '@vcraft/api-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminAccounts } from '@/features/admin/admin-accounts';
import { AdminPaymentsList } from '@/features/admin/admin-payments-list';
import { AuditLogView } from '@/features/admin/audit-log';
import { BuyerRfqList } from '@/features/rfq/buyer-rfq-list';
import { RfqForm } from '@/features/rfq/rfq-form';
import { QrLabelsButton } from '@/features/studio/qr-labels-button';
import { renderVi } from './render';

const push = vi.fn();
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
  useRouter: () => ({ push }),
}));

/** A promise the test settles by hand, to order responses the way a slow network would. */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

const ID = '123e4567-e89b-12d3-a456-426614174000';
const rfqRow = (title: string) => ({
  id: `${ID}-${title}`,
  version: 1,
  revision: 1,
  status: 'BIDDING',
  title,
  quantity: 1,
  unit: 'cup',
  biddingClosesAt: '2099-12-01T00:00:00.000Z',
  openQuotationCount: 0,
  acceptedTotalVnd: null,
});

describe('BuyerRfqList: stale responses (GH#431)', () => {
  it('drops a slow response for an old filter', async () => {
    const slow = deferred<{ data: unknown[]; nextCursor: null }>();
    const listRequests = vi
      .fn()
      .mockResolvedValueOnce({ data: [rfqRow('Initial')], nextCursor: null })
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ data: [rfqRow('Newest filter')], nextCursor: null });
    renderVi(<BuyerRfqList client={{ listRequests } as unknown as QuotationClient} />);
    await screen.findByText('Initial');

    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACCEPTED' } });
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'CANCELLED' } });
    await screen.findByText('Newest filter');
    await act(async () => slow.resolve({ data: [rfqRow('Old filter')], nextCursor: null }));
    expect(screen.queryByText('Old filter')).toBeNull();
    expect(screen.getByText('Newest filter')).toBeTruthy();
  });

  it('does not append a "load more" page that started before a filter change', async () => {
    const more = deferred<{ data: unknown[]; nextCursor: null }>();
    const listRequests = vi
      .fn()
      .mockResolvedValueOnce({ data: [rfqRow('First page')], nextCursor: 'next' })
      .mockReturnValueOnce(more.promise)
      .mockResolvedValueOnce({ data: [rfqRow('Filtered')], nextCursor: null });
    renderVi(<BuyerRfqList client={{ listRequests } as unknown as QuotationClient} />);
    await screen.findByText('First page');
    fireEvent.click(screen.getByRole('button', { name: 'Xem thêm' }));
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'ACCEPTED' } });
    await screen.findByText('Filtered');
    await act(async () => more.resolve({ data: [rfqRow('Late page')], nextCursor: null }));
    expect(screen.queryByText('Late page')).toBeNull();
  });
});

describe('AuditLogView: stale responses (GH#431)', () => {
  const entry = (name: string) => ({
    id: `00000000-0000-4000-8000-${name.length.toString().padStart(12, '0')}`,
    actorId: null,
    actorName: name,
    action: 'household.reject',
    entity: 'household',
    entityId: '00000000-0000-4000-8000-000000000004',
    targetLabel: 'Target',
    before: null,
    after: null,
    createdAt: '2026-10-30T03:00:00.000Z',
  });

  it('drops a slow response for old filters', async () => {
    const slow = deferred<unknown>();
    const auditLog = vi
      .fn()
      .mockResolvedValueOnce({ data: [entry('Initial')], nextCursor: null })
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ data: [entry('Newest')], nextCursor: null });
    const auditActors = vi.fn().mockResolvedValue([]);
    renderVi(<AuditLogView client={{ auditLog, auditActors } as unknown as AdminClient} />);
    await screen.findByText('Initial');
    fireEvent.change(screen.getByLabelText('Hành động'), { target: { value: 'rfq.claim' } });
    fireEvent.change(screen.getByLabelText('Từ ngày'), { target: { value: '2026-10-01' } });
    await screen.findByText('Newest');
    await act(async () => slow.resolve({ data: [entry('Stale!')], nextCursor: null }));
    expect(screen.queryByText('Stale!')).toBeNull();
  });

  it('does not append a "load more" page that started before a filter change', async () => {
    const more = deferred<unknown>();
    const auditLog = vi
      .fn()
      .mockResolvedValueOnce({ data: [entry('Initial')], nextCursor: 'abc' })
      .mockReturnValueOnce(more.promise)
      .mockResolvedValueOnce({ data: [entry('Filtered')], nextCursor: null });
    const auditActors = vi.fn().mockResolvedValue([]);
    renderVi(<AuditLogView client={{ auditLog, auditActors } as unknown as AdminClient} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Xem thêm' }));
    fireEvent.change(screen.getByLabelText('Hành động'), { target: { value: 'rfq.claim' } });
    await screen.findByText('Filtered');
    await act(async () => more.resolve({ data: [entry('Late!')], nextCursor: null }));
    expect(screen.queryByText('Late!')).toBeNull();
  });
});

describe('AdminPaymentsList: stale responses (GH#431)', () => {
  const payment = (buyerName: string) => ({
    id: `p-${buyerName}`,
    orderId: ID,
    orderTitle: 'Order',
    buyerName,
    kind: 'DEPOSIT',
    method: 'OFFLINE',
    amountVnd: 1000,
    status: 'PAID',
    referenceCode: `REF-${buyerName}`,
    createdAt: '2026-10-30T03:00:00.000Z',
  });

  it('drops a slow response for an old filter', async () => {
    const slow = deferred<unknown>();
    const adminPayments = vi
      .fn()
      .mockResolvedValueOnce({ data: [payment('Initial')], nextCursor: null })
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ data: [payment('Newest')], nextCursor: null });
    renderVi(<AdminPaymentsList client={{ adminPayments } as unknown as PaymentClient} />);
    await screen.findByText('Initial');
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'PAID' } });
    fireEvent.change(screen.getByLabelText('Trạng thái'), { target: { value: 'FAILED' } });
    await screen.findByText('Newest');
    await act(async () => slow.resolve({ data: [payment('Stale!')], nextCursor: null }));
    expect(screen.queryByText('Stale!')).toBeNull();
  });
});

describe('AdminAccounts: stale responses (GH#431)', () => {
  const user = (fullName: string) => ({
    id: `u-${fullName}`,
    email: `${fullName}@example.com`,
    username: fullName,
    fullName,
    role: 'BUYER',
    status: 'ACTIVE',
    statusReason: null,
    createdAt: '2026-11-01T00:00:00.000Z',
  });

  it('drops a slow response for an old filter', async () => {
    const slow = deferred<unknown>();
    const listUsers = vi
      .fn()
      .mockResolvedValueOnce({ items: [user('Initial')] })
      .mockReturnValueOnce(slow.promise)
      .mockResolvedValueOnce({ items: [user('Newest')] });
    const client = { listUsers, listInvitations: vi.fn().mockResolvedValue({ items: [] }) };
    renderVi(<AdminAccounts client={client as unknown as AdminClient} />);
    await screen.findByText('Initial');
    const role = within(screen.getByRole('form', { name: 'Lọc người dùng' })).getByLabelText(
      'Vai trò',
    );
    fireEvent.change(role, { target: { value: 'ADMIN' } });
    fireEvent.change(role, { target: { value: 'BUYER' } });
    await screen.findByText('Newest');
    await act(async () => slow.resolve({ items: [user('Stale!')] }));
    expect(screen.queryByText('Stale!')).toBeNull();
  });
});

describe('RfqForm: send versus autosave (GH#431)', () => {
  const draftRow = { id: ID, status: 'DRAFT', title: 'Logo cups' };
  const fill = () => {
    const type = (label: string, value: string) =>
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    type('Tiêu đề', 'Logo cups');
    fireEvent.change(screen.getByLabelText('Danh mục'), { target: { value: 'TABLEWARE' } });
    type('Mô tả', 'Cups');
    type('Số lượng', '100');
    type('Đơn vị', 'cup');
    type('Hạn chào giá', '2099-12-01');
    type('Ngày cần hàng', '2100-02-01');
    type('Nơi giao hàng', 'Hanoi');
    fireEvent.click(screen.getByRole('checkbox', { name: /Chính sách quyền riêng tư/ }));
  };
  const apiWith = (over: { createRequest: ReturnType<typeof vi.fn> }) => ({
    updateRequest: vi.fn().mockResolvedValue({ ...draftRow, version: 2 }),
    submitRequest: vi.fn().mockResolvedValue({ id: ID, status: 'SENT', invitedHouseholdIds: [] }),
    recordConsent: vi.fn().mockResolvedValue({}),
    listHouseholds: vi.fn().mockResolvedValue({ data: [] }),
    ...over,
  });

  beforeEach(() => {
    window.localStorage.clear();
    push.mockClear();
  });

  it('cancels the pending autosave so submit and update never race with one version', async () => {
    const api = apiWith({ createRequest: vi.fn().mockResolvedValue({ ...draftRow, version: 1 }) });
    renderVi(<RfqForm client={api as unknown as QuotationClient} />);
    await screen.findByLabelText('Tiêu đề');
    fill();
    // Send before the 800 ms autosave timer fires.
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await waitFor(() =>
      expect(api.submitRequest).toHaveBeenCalledWith(ID, 1, { idempotencyKey: expect.any(String) }),
    );
    await waitFor(() => expect(push).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 1_200));
    expect(api.createRequest).toHaveBeenCalledTimes(1);
    expect(api.updateRequest).not.toHaveBeenCalled();
    expect(api.submitRequest).toHaveBeenCalledTimes(1);
    // The timer must not write the local draft back after it was cleared.
    expect(window.localStorage.getItem('vcraft.rfq-draft')).toBeNull();
  });

  it('waits for an in-flight autosave, saves later edits, then submits the returned version', async () => {
    const firstSave = deferred<unknown>();
    const api = apiWith({ createRequest: vi.fn().mockReturnValue(firstSave.promise) });
    renderVi(<RfqForm client={api as unknown as QuotationClient} />);
    await screen.findByLabelText('Tiêu đề');
    fill();
    await waitFor(() => expect(api.createRequest).toHaveBeenCalledTimes(1), { timeout: 2_000 });
    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: 'Edited cups' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gửi yêu cầu' }));
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(api.submitRequest).not.toHaveBeenCalled();
    await act(async () => firstSave.resolve({ ...draftRow, version: 1 }));
    await waitFor(() =>
      expect(api.submitRequest).toHaveBeenCalledWith(ID, 2, { idempotencyKey: expect.any(String) }),
    );
    expect(api.createRequest).toHaveBeenCalledTimes(1);
    expect(api.updateRequest).toHaveBeenCalledWith(
      ID,
      1,
      expect.objectContaining({ title: 'Edited cups' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(window.localStorage.getItem('vcraft.rfq-draft')).toBeNull();
  });
});

describe('QrLabelsButton: lifecycle (GH#431)', () => {
  const open = vi.fn();
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('open', open);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    open.mockReset();
  });

  const readyClient = () => ({
    requestQrLabels: vi.fn(async () => ({ requestId: 'r1', status: 'PENDING', url: null })),
    qrLabelsStatus: vi
      .fn()
      .mockResolvedValue({ requestId: 'r1', status: 'READY', url: 'https://s/labels.pdf' }),
  });

  it('stops polling and does not open the PDF once unmounted', async () => {
    const api = readyClient();
    const { unmount } = renderVi(
      <QrLabelsButton client={api as never} productIds={['p1']} label="In nhãn" />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10);
    });
    unmount();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(10_000);
    });
    expect(api.qrLabelsStatus).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it('opens the ready PDF in a new tab without an opener', async () => {
    const api = readyClient();
    renderVi(<QrLabelsButton client={api as never} productIds={['p1']} label="In nhãn" />);
    fireEvent.click(screen.getByRole('button', { name: 'In nhãn' }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2_000);
    });
    expect(open).toHaveBeenCalledWith('https://s/labels.pdf', '_blank', 'noopener');
  });
});
