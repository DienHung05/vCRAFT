import { describe, expect, it } from 'vitest';
import { buyerEvents, rfqStepperModel } from '@/features/rfq/rfq-flow';

describe('rfq-flow (FR-RFQ-12)', () => {
  it('chỉ hiện sự kiện của Buyer chủ RFQ, lấy từ máy trạng thái domain', () => {
    expect(buyerEvents('DRAFT')).toEqual(['SUBMIT', 'CANCEL']);
    expect(buyerEvents('SENT')).toEqual(['CANCEL']); // RECEIVE_BID/EXPIRE là của hộ và hệ thống
    expect(buyerEvents('BIDDING')).toEqual(['ACCEPT_BID', 'CANCEL']);
    expect(buyerEvents('ACCEPTED')).toEqual([]); // START_PRODUCTION/ADMIN_CANCEL là của Admin
    expect(buyerEvents('IN_PRODUCTION')).toEqual(['CONFIRM_DELIVERY']);
    expect(buyerEvents('DELIVERED')).toEqual([]);
    expect(buyerEvents('CANCELLED')).toEqual([]);
  });

  it('stepper: đường chính và trạng thái dừng', () => {
    expect(rfqStepperModel('BIDDING', true)).toMatchObject({ current: 2, halted: false });
    expect(rfqStepperModel('DELIVERED', true)).toMatchObject({ current: 5, halted: false });
    const cancelled = rfqStepperModel('CANCELLED', true);
    expect(cancelled).toMatchObject({ current: 2, halted: true });
    expect(cancelled.steps.at(-1)).toBe('CANCELLED');
    expect(rfqStepperModel('EXPIRED', false)).toMatchObject({ current: 1, halted: true });
  });
});
