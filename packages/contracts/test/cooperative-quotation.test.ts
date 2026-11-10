import { describe, expect, it } from 'vitest';
import {
  BuyerQuotationResponseSchema,
  CreateContributionRequestSchema,
  CreateCooperativeQuotationRequestSchema,
  CreateDirectQuotationRequestSchema,
  DirectQuotationResponseSchema,
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

describe('direct quotation input', () => {
  const completionDate = '2027-02-01T00:00:00.000Z';

  it('takes a unit price, a date and an optional trimmed note', () => {
    const parsed = CreateDirectQuotationRequestSchema.safeParse({
      unitPriceVnd: 30_000,
      completionDate,
      note: '  Two firings  ',
    });
    expect(parsed.success && parsed.data.note).toBe('Two firings');
    expect(
      CreateDirectQuotationRequestSchema.safeParse({ unitPriceVnd: 30_000, completionDate })
        .success,
    ).toBe(true);
  });

  it('refuses a free price, a long note and fields that belong to the request', () => {
    expect(
      CreateDirectQuotationRequestSchema.safeParse({ unitPriceVnd: 0, completionDate }).success,
    ).toBe(false);
    expect(
      CreateDirectQuotationRequestSchema.safeParse({
        unitPriceVnd: 1,
        completionDate,
        note: 'x'.repeat(501),
      }).success,
    ).toBe(false);
    expect(
      CreateDirectQuotationRequestSchema.safeParse({ unitPriceVnd: 1, completionDate, quantity: 5 })
        .success,
    ).toBe(false);
  });
});

describe('direct quotation response (GH#445)', () => {
  const completionDate = '2027-02-01T00:00:00.000Z';
  const direct = {
    id: '123e4567-e89b-12d3-a456-426614174000',
    version: 2,
    status: 'SUBMITTED',
    quantity: 100,
    unitPriceVnd: 30_000,
    totalVnd: 3_000_000,
    completionDate,
    note: null,
  };

  it('accepts a quotation read from its stored part', () => {
    expect(DirectQuotationResponseSchema.safeParse(direct).success).toBe(true);
  });

  it('accepts a quotation stored without parts as nulls, not sentinels', () => {
    const parsed = DirectQuotationResponseSchema.safeParse({
      ...direct,
      unitPriceVnd: null,
      completionDate: null,
    });
    expect(parsed.success).toBe(true);
    if (parsed.success)
      expect(parsed.data).toMatchObject({ unitPriceVnd: null, completionDate: null });
  });

  it('still refuses a zero price, an empty date and an absent total', () => {
    for (const broken of [
      { ...direct, unitPriceVnd: 0 },
      { ...direct, completionDate: '' },
      { ...direct, totalVnd: undefined },
    ])
      expect(DirectQuotationResponseSchema.safeParse(broken).success).toBe(false);
  });
});
