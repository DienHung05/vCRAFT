import { screen } from '@testing-library/react';
import type { AllocationScheduleDto } from '@vcraft/contracts';
import { describe, expect, it } from 'vitest';
import { AllocationTimeline } from '@/features/orders/allocation-timeline';
import { renderEn, renderVi } from './render';

type Share = AllocationScheduleDto[number]['allocations'][number];
const share = (overrides: Partial<Share> = {}): Share => ({
  id: 'one',
  version: 1,
  householdId: 'household',
  householdName: 'Gốm Minh Hải',
  quantity: 100,
  completedQty: 20,
  status: 'IN_PROGRESS',
  startedAt: '2026-11-01T00:00:00Z',
  dueAt: '2026-11-20T00:00:00Z',
  lateness: 'BEHIND',
  expectedQty: 50,
  ...overrides,
});

describe('Authorized allocation timeline', () => {
  it('weights order progress by quantity and gives household names, dates and risk in text', () => {
    renderVi(
      <AllocationTimeline
        unit="cốc"
        shares={[
          share({ quantity: 10, completedQty: 10, lateness: 'DONE', status: 'DONE' }),
          share({
            id: 'two',
            householdName: 'Gốm Đại Phong',
            quantity: 90,
            completedQty: 0,
            lateness: 'OVERDUE',
          }),
        ]}
      />,
    );
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('10');
    expect(screen.getByText('Gốm Minh Hải')).toBeTruthy();
    expect(screen.getByText('Gốm Đại Phong')).toBeTruthy();
    expect(screen.getByText('Quá hạn')).toBeTruthy();
  });

  it.each([
    [0, 0, 'CANCELLED', 0],
    [100, 100, 'DONE', 100],
  ] as const)('handles %s pieces and %s completed', (quantity, completedQty, status, expected) => {
    renderEn(
      <AllocationTimeline
        unit="cups"
        shares={[share({ quantity, completedQty, status, lateness: 'DONE' })]}
      />,
    );
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe(String(expected));
    expect(screen.queryByText('Overdue')).toBeNull();
  });

  it('labels the expected figure with a noun and the unit, and hides it once the share is done (GH#478)', () => {
    const { unmount } = renderVi(
      <AllocationTimeline unit="cái" shares={[share({ quantity: 600, completedQty: 300 })]} />,
    );
    expect(screen.getByText(/dự kiến đến hôm nay: 50 cái/i)).toBeTruthy();
    unmount();
    renderEn(
      <AllocationTimeline unit="pcs" shares={[share({ quantity: 600, completedQty: 300 })]} />,
    );
    expect(screen.getByText(/expected by today: 50 pcs/i)).toBeTruthy();
  });

  it('does not show the expected figure on a share that is fully done', () => {
    renderVi(
      <AllocationTimeline
        unit="cái"
        shares={[
          share({
            quantity: 600,
            completedQty: 600,
            expectedQty: 95,
            lateness: 'DONE',
            status: 'DONE',
          }),
        ]}
      />,
    );
    expect(screen.getAllByText(/600\/600 cái/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/dự kiến/i)).toBeNull();
  });

  it('keeps cancelled history out of the order total and does not warn about unstarted work', () => {
    renderEn(
      <AllocationTimeline
        unit="cups"
        shares={[
          share({ status: 'CANCELLED', quantity: 100, completedQty: 0, lateness: 'OVERDUE' }),
          share({
            id: 'two',
            status: 'CONFIRMED',
            quantity: 100,
            completedQty: 50,
            lateness: 'OVERDUE',
          }),
        ]}
      />,
    );
    expect(screen.getByRole('progressbar').getAttribute('value')).toBe('50');
    expect(screen.queryByText('Overdue')).toBeNull();
  });

  it('provides a no-data state without an invalid timeline', () => {
    renderEn(<AllocationTimeline unit="cups" shares={[]} />);
    expect(screen.getByText('No allocations yet.')).toBeTruthy();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});
