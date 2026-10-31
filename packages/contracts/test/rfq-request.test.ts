import { describe, expect, it } from 'vitest';
import {
  AcceptBidRequestSchema,
  CreateRfqRequestSchema,
  RfqResponseSchema,
  UpdateRfqRequestSchema,
} from '../src';

const valid = {
  design: 'Binh gom men ran',
  quantity: 5000,
  unit: 'chiec',
  destination: 'Ha Noi',
  requiredBy: '2027-03-01T00:00:00.000Z',
  biddingClosesAt: '2027-01-10T00:00:00.000Z',
  invitedHouseholdIds: ['123e4567-e89b-12d3-a456-426614174000'],
  coordinationOptIn: true,
};

describe('GH#9 contracts: request creation', () => {
  it('accepts full valid request with invites + coordination opt-in', () => {
    expect(CreateRfqRequestSchema.safeParse(valid).success).toBe(true);
  });

  it('requires design, quantity, destination, delivery date, deadline', () => {
    for (const field of [
      'design',
      'quantity',
      'destination',
      'requiredBy',
      'biddingClosesAt',
    ] as const) {
      const { [field]: _drop, ...rest } = valid;
      const r = CreateRfqRequestSchema.safeParse(rest);
      expect(r.success, field).toBe(false);
    }
  });

  it('refuses zero quantity and past relations (delivery must follow deadline)', () => {
    expect(CreateRfqRequestSchema.safeParse({ ...valid, quantity: 0 }).success).toBe(false);
    expect(
      CreateRfqRequestSchema.safeParse({
        ...valid,
        requiredBy: '2027-01-01T00:00:00.000Z',
      }).success,
    ).toBe(false);
  });

  it('update is draft-shape (version travels in If-Match header, BR-L1); response carries id + version + revision', () => {
    expect(UpdateRfqRequestSchema.safeParse(valid).success).toBe(true);
    const res = RfqResponseSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      version: 3,
      revision: 1,
      status: 'DRAFT',
      title: 'Logo cups',
      category: null,
      budgetMinVnd: null,
      budgetMaxVnd: null,
      cancelReason: null,
      createdAt: '2026-10-31T00:00:00.000Z',
      ...valid,
    });
    expect(res.success).toBe(true);
  });

  it('requires at least one invite or coordination opt-in', () => {
    expect(
      CreateRfqRequestSchema.safeParse({
        ...valid,
        invitedHouseholdIds: [],
        coordinationOptIn: false,
      }).success,
    ).toBe(false);
    expect(
      CreateRfqRequestSchema.safeParse({
        ...valid,
        invitedHouseholdIds: [],
        coordinationOptIn: true,
      }).success,
    ).toBe(true);
  });

  it('accept-bid body carries only the chosen bid (version travels in If-Match header, BR-L1)', () => {
    expect(AcceptBidRequestSchema.safeParse({ bidId: valid.invitedHouseholdIds[0] }).success).toBe(
      true,
    );
    expect(AcceptBidRequestSchema.safeParse({}).success).toBe(false);
  });
});
