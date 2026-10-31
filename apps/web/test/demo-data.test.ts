// @vitest-environment node
import { transition } from '@vcraft/domain';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { demoParams, getRfq } from '@/lib/demo/data';

afterEach(() => vi.useRealTimers());

async function acceptAt(now: string) {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(now));
  const code = demoParams.rfqs[0] ?? '';
  const rfq = await getRfq(code);
  const bid = rfq?.bids.find((b) => b.quantityOffered >= (rfq?.quantity ?? 0));
  if (!rfq || !bid) throw new Error('thiếu dữ liệu mẫu');
  const result = transition('BIDDING', 'ACCEPT_BID', {
    actor: 'BUYER_OWNER',
    now: new Date(),
    biddingClosesAt: new Date(rfq.biddingClosesAt),
    requiredBy: new Date(rfq.requiredBy),
    quantity: rfq.quantity,
    emailVerified: true,
    allocationStatuses: [],
    bid: { status: bid.status, quantityOffered: bid.quantityOffered },
  });
  return { rfq, result };
}

describe('dữ liệu mẫu tính theo thời điểm hiện tại', () => {
  it.each(['2026-10-28T09:00:00Z', '2027-03-15T09:00:00Z', '2030-01-01T00:00:00Z'])(
    'tại %s: hạn chào giá còn phía trước và nút chốt demo không bị hạn cứng chặn',
    async (now) => {
      const { rfq, result } = await acceptAt(now);
      expect(new Date(rfq.biddingClosesAt).getTime()).toBeGreaterThan(Date.now());
      expect(new Date(rfq.createdAt).getTime()).toBeLessThan(new Date(rfq.sentAt).getTime());
      expect(new Date(rfq.sentAt).getTime()).toBeLessThan(Date.now());
      expect(result.ok).toBe(true);
    },
  );
});
