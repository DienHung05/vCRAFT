import { describe, expect, it } from 'vitest';
import {
  AcceptQuotationRequestSchema,
  AllocationResponseSchema,
  ReportProgressRequestSchema,
} from '../src/orders';

const UUID = '123e4567-e89b-12d3-a456-426614174000';

describe('order confirmation, progress and receipt contracts (GH#11)', () => {
  it('accepts an acceptance naming the chosen quotation', () => {
    expect(AcceptQuotationRequestSchema.safeParse({ quotationId: UUID }).success).toBe(true);
  });

  it('rejects acceptance with extra fields or a bad id', () => {
    expect(AcceptQuotationRequestSchema.safeParse({ quotationId: UUID, version: 2 }).success).toBe(
      false,
    );
    expect(AcceptQuotationRequestSchema.safeParse({ quotationId: 'nope' }).success).toBe(false);
  });

  it('accepts an allocation with completed quantity inside the plan', () => {
    const result = AllocationResponseSchema.safeParse({
      id: UUID,
      version: 1,
      householdId: UUID,
      quantity: 2000,
      completedQty: 500,
      status: 'IN_PROGRESS',
    });
    expect(result.success).toBe(true);
  });

  it('accepts a progress report of zero and of the full allocation', () => {
    expect(ReportProgressRequestSchema.safeParse({ completedQty: 0 }).success).toBe(true);
    expect(ReportProgressRequestSchema.safeParse({ completedQty: 2000 }).success).toBe(true);
  });

  it('rejects negative, fractional, or non-numeric progress', () => {
    for (const completedQty of [-1, 2.5, Number.NaN, 'many']) {
      expect(ReportProgressRequestSchema.safeParse({ completedQty }).success).toBe(false);
    }
  });
});
