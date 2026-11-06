import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { AdminClient } from '@vcraft/api-client';
import type { AllocationScheduleDto } from '@vcraft/contracts';
import { describe, expect, it, vi } from 'vitest';
import { AllocationGantt } from '@/features/admin/allocation-gantt';
import { renderVi } from './render';

vi.mock('@/lib/notify', () => ({ notify: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }));
vi.mock('@/i18n/navigation', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/x">{children}</a>,
}));

const DAY = 86_400_000;
const id = (n: number) => `00000000-0000-4000-8000-00000000000${n}`;
const ORDERS: AllocationScheduleDto = [
  {
    requestId: id(1),
    title: '5.000 cốc men lam',
    unit: 'cốc',
    requiredBy: new Date(Date.now() + 10 * DAY).toISOString(),
    allocations: [
      {
        id: id(2),
        version: 4,
        householdId: id(3),
        householdName: 'Gốm Minh Hải',
        quantity: 1000,
        completedQty: 200,
        status: 'IN_PROGRESS',
        startedAt: new Date(Date.now() - 5 * DAY).toISOString(),
        dueAt: new Date(Date.now() + 5 * DAY).toISOString(),
        lateness: 'BEHIND',
        expectedQty: 500,
      },
      {
        id: id(4),
        version: 2,
        householdId: id(5),
        householdName: 'Gốm Đại Phong',
        quantity: 4000,
        completedQty: 2100,
        status: 'IN_PROGRESS',
        startedAt: new Date(Date.now() - 5 * DAY).toISOString(),
        dueAt: new Date(Date.now() + 5 * DAY).toISOString(),
        lateness: 'ON_TRACK',
        expectedQty: 2000,
      },
    ],
  },
];

function client(overrides: Partial<AdminClient> = {}): AdminClient {
  return {
    allocationSchedule: vi.fn(async () => ORDERS),
    listHouseholds: vi.fn(async () => [
      { id: id(3), name: 'Gốm Minh Hải', status: 'APPROVED', submittedAt: '2026-10-01T00:00:00Z' },
      { id: id(6), name: 'Gốm Bích Hợp', status: 'APPROVED', submittedAt: '2026-10-01T00:00:00Z' },
    ]),
    reallocate: vi.fn(async () => ORDERS),
    ...overrides,
  } as unknown as AdminClient;
}

describe('AllocationGantt', () => {
  it('shows each share with its progress in words and flags the late one', async () => {
    renderVi(<AllocationGantt client={client()} />);
    expect(await screen.findByRole('heading', { name: '5.000 cốc men lam' })).toBeTruthy();
    expect(screen.getByText(/200\/1\.000 cốc · dự kiến 500/)).toBeTruthy();
    expect(screen.getByText('Chậm')).toBeTruthy();
    expect(screen.getByText('Đúng tiến độ')).toBeTruthy();
    // Only the late share offers a reallocation.
    expect(screen.getAllByRole('button', { name: 'Chia lại phần còn lại' })).toHaveLength(1);
  });

  it('reallocates the remaining pieces to another household', async () => {
    const admin = client();
    renderVi(<AllocationGantt client={admin} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Chia lại phần còn lại' }));
    const select = await screen.findByRole('combobox', { name: 'Hộ nhận' });
    // The late household is not offered as a target.
    await waitFor(() => expect(screen.getByRole('option', { name: 'Gốm Bích Hợp' })).toBeTruthy());
    expect(screen.queryByRole('option', { name: 'Gốm Minh Hải' })).toBeNull();
    fireEvent.change(select, { target: { value: id(6) } });
    expect(screen.getByText('Đã chia 800/800 cốc')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Xác nhận chia lại' }));
    await waitFor(() =>
      expect(admin.reallocate).toHaveBeenCalledWith(id(2), 4, {
        targets: [{ householdId: id(6), quantity: 800 }],
      }),
    );
  });
});
