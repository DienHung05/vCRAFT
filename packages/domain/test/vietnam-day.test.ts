import { describe, expect, it } from 'vitest';
import { allocationLateness, endOfVietnamDay } from '../src';

describe('endOfVietnamDay', () => {
  it('is 23:59:59 at +07:00, which is 16:59:59 UTC the same date', () => {
    expect(endOfVietnamDay('2026-11-20').toISOString()).toBe('2026-11-20T16:59:59.000Z');
  });
});

describe('a household completion date promised for one day', () => {
  const allocation = {
    quantity: 100,
    completedQty: 50,
    startedAt: new Date('2026-11-01T00:00:00Z'),
    dueAt: endOfVietnamDay('2026-11-20'),
  };

  it('is not overdue during the promised day in Vietnam', () => {
    // 20 Nov 08:00 and 23:00 in Vietnam
    expect(allocationLateness(allocation, new Date('2026-11-20T01:00:00Z')).status).not.toBe(
      'OVERDUE',
    );
    expect(allocationLateness(allocation, new Date('2026-11-20T16:00:00Z')).status).not.toBe(
      'OVERDUE',
    );
  });

  it('is overdue from the next day in Vietnam', () => {
    expect(allocationLateness(allocation, new Date('2026-11-20T17:00:00Z')).status).toBe('OVERDUE');
  });
});
