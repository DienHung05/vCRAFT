import { describe, expect, it } from 'vitest';
import {
  BuyerQuotationResponseSchema,
  CreateContributionRequestSchema,
  CreateCooperativeQuotationRequestSchema,
} from '../src';

const validContribution = {
  maxQuantity: 2000,
  unitPriceVnd: 30_000,
  completionDate: '2027-02-01T00:00:00.000Z',
};

const validQuotation = {
  parts: [
    {
      householdId: '123e4567-e89b-12d3-a456-426614174000',
      quantity: 2000,
      unitPriceVnd: 30_000,
      completionDate: '2027-02-01T00:00:00.000Z',
      contributionVersion: 4,
    },
  ],
  additionalChargeVnd: 1_000_000,
  deliveryTerms: 'INCLUDED',
};

describe('contribution and cooperative quotation contracts', () => {
  it('accepts a contribution with its declared limits', () => {
    expect(CreateContributionRequestSchema.safeParse(validContribution).success).toBe(true);
  });

  it('rejects zero quantity, zero price, and malformed completion dates', () => {
    for (const field of ['maxQuantity', 'unitPriceVnd', 'completionDate'] as const) {
      const value = field === 'maxQuantity' || field === 'unitPriceVnd' ? 0 : 'tomorrow';
      expect(
        CreateContributionRequestSchema.safeParse({ ...validContribution, [field]: value }).success,
      ).toBe(false);
    }
  });

  it('accepts admin quotation input but does not put buyer visibility in the request', () => {
    expect(CreateCooperativeQuotationRequestSchema.safeParse(validQuotation).success).toBe(true);
    expect(
      CreateCooperativeQuotationRequestSchema.safeParse({
        ...validQuotation,
        parts: [{ ...validQuotation.parts[0], buyerUnitPriceVnd: 1 }],
      }).success,
    ).toBe(false);
  });

  it('defines a buyer response without per-household prices', () => {
    const result = BuyerQuotationResponseSchema.safeParse({
      id: '123e4567-e89b-12d3-a456-426614174000',
      version: 2,
      status: 'SUBMITTED',
      quantity: 2000,
      parts: [
        {
          householdId: '123e4567-e89b-12d3-a456-426614174000',
          householdName: 'Gốm Minh Hải',
          quantity: 2000,
          completionDate: '2027-02-01T00:00:00.000Z',
        },
      ],
      productionTotalVnd: 60_000_000,
      additionalChargeVnd: 1_000_000,
      totalVnd: 61_000_000,
      deliveryTerms: 'INCLUDED',
    });

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.parts[0]).not.toHaveProperty('unitPriceVnd');
  });
});

describe('quantity storage limits', () => {
  it('rejects quantities outside signed SQL integer storage', () => {
    expect(
      CreateContributionRequestSchema.safeParse({
        ...validContribution,
        maxQuantity: 2_147_483_648,
      }).success,
    ).toBe(false);
  });
});
