import { describe, expect, it } from 'vitest';
import {
  assembleCooperativeQuotation,
  assembleDirectQuotation,
  type ContributionOffer,
  projectBuyerQuotation,
} from '../src';

const deadline = new Date('2027-01-10T00:00:00.000Z');
const requiredBy = new Date('2027-02-10T00:00:00.000Z');

const contributions: [ContributionOffer, ContributionOffer, ContributionOffer] = [
  {
    householdId: 'household-a',
    maxQuantity: 2000,
    unitPriceVnd: 30_000,
    completionDate: new Date('2027-02-01T00:00:00.000Z'),
    version: 4,
  },
  {
    householdId: 'household-b',
    maxQuantity: 1500,
    unitPriceVnd: 32_000,
    completionDate: new Date('2027-02-03T00:00:00.000Z'),
    version: 7,
  },
  {
    householdId: 'household-c',
    maxQuantity: 1500,
    unitPriceVnd: 34_000,
    completionDate: new Date('2027-02-05T00:00:00.000Z'),
    version: 2,
  },
];

const validDraft = {
  requiredQuantity: 5000,
  biddingClosesAt: deadline,
  requiredBy,
  contributions,
  parts: [
    {
      householdId: 'household-a',
      quantity: 2000,
      unitPriceVnd: 30_000,
      completionDate: contributions[0].completionDate,
      contributionVersion: 4,
    },
    {
      householdId: 'household-b',
      quantity: 1500,
      unitPriceVnd: 32_000,
      completionDate: contributions[1].completionDate,
      contributionVersion: 7,
    },
    {
      householdId: 'household-c',
      quantity: 1500,
      unitPriceVnd: 34_000,
      completionDate: contributions[2].completionDate,
      contributionVersion: 2,
    },
  ],
  additionalChargeVnd: 1_000_000,
  deliveryTerms: 'INCLUDED' as const,
};

describe('assembleCooperativeQuotation', () => {
  it('accepts exact coverage and calculates one buyer price', () => {
    const result = assembleCooperativeQuotation(validDraft);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.productionTotalVnd).toBe(159_000_000);
    expect(result.value.additionalChargeVnd).toBe(1_000_000);
    expect(result.value.totalVnd).toBe(160_000_000);
  });

  it('rejects a plan that does not cover the full request', () => {
    const result = assembleCooperativeQuotation({
      ...validDraft,
      parts: validDraft.parts.slice(0, 2),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('QUOTATION_QUANTITY_MISMATCH');
  });

  it('rejects a share above the household contribution limit', () => {
    const result = assembleCooperativeQuotation({
      ...validDraft,
      parts: validDraft.parts.map((part) =>
        part.householdId === 'household-a' ? { ...part, quantity: 2001 } : part,
      ),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONTRIBUTION_QUANTITY_EXCEEDED');
  });

  it('rejects rewritten price or completion date', () => {
    const price = assembleCooperativeQuotation({
      ...validDraft,
      parts: validDraft.parts.map((part) =>
        part.householdId === 'household-b' ? { ...part, unitPriceVnd: 31_000 } : part,
      ),
    });
    const date = assembleCooperativeQuotation({
      ...validDraft,
      parts: validDraft.parts.map((part) =>
        part.householdId === 'household-c'
          ? { ...part, completionDate: new Date('2027-02-06T00:00:00.000Z') }
          : part,
      ),
    });

    expect(price.ok).toBe(false);
    if (!price.ok) expect(price.error.code).toBe('CONTRIBUTION_PRICE_MISMATCH');
    expect(date.ok).toBe(false);
    if (!date.ok) expect(date.error.code).toBe('CONTRIBUTION_DATE_MISMATCH');
  });

  it('rejects a stale contribution version', () => {
    const result = assembleCooperativeQuotation({
      ...validDraft,
      parts: validDraft.parts.map((part) =>
        part.householdId === 'household-a' ? { ...part, contributionVersion: 3 } : part,
      ),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('CONTRIBUTION_VERSION_MISMATCH');
  });

  it('requires completion dates after the quotation deadline and no later than delivery', () => {
    const result = assembleCooperativeQuotation({
      ...validDraft,
      parts: validDraft.parts.map((part) =>
        part.householdId === 'household-a' ? { ...part, completionDate: deadline } : part,
      ),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('COMPLETION_DATE_INVALID');
  });
});

describe('projectBuyerQuotation', () => {
  it('shows shares, dates and the complete price without internal rates', () => {
    const assembled = assembleCooperativeQuotation(validDraft);
    expect(assembled.ok).toBe(true);
    if (!assembled.ok) return;

    const buyer = projectBuyerQuotation(assembled.value);

    expect(buyer).toEqual({
      quantity: 5000,
      parts: [
        {
          householdId: 'household-a',
          quantity: 2000,
          completionDate: new Date('2027-02-01T00:00:00.000Z'),
        },
        {
          householdId: 'household-b',
          quantity: 1500,
          completionDate: new Date('2027-02-03T00:00:00.000Z'),
        },
        {
          householdId: 'household-c',
          quantity: 1500,
          completionDate: new Date('2027-02-05T00:00:00.000Z'),
        },
      ],
      productionTotalVnd: 159_000_000,
      additionalChargeVnd: 1_000_000,
      totalVnd: 160_000_000,
      deliveryTerms: 'INCLUDED',
    });
    expect(buyer.parts[0]).not.toHaveProperty('unitPriceVnd');
  });
});

describe('assembleDirectQuotation', () => {
  const draft = {
    requiredQuantity: 5000,
    biddingClosesAt: deadline,
    requiredBy,
    householdId: 'household-a',
    unitPriceVnd: 30_000,
    completionDate: new Date('2027-02-01T00:00:00.000Z'),
  };

  it('quotes the whole quantity as one part with the household price', () => {
    const result = assembleDirectQuotation(draft);
    expect(result.ok && result.value).toMatchObject({
      quantity: 5000,
      productionTotalVnd: 150_000_000,
      additionalChargeVnd: 0,
      totalVnd: 150_000_000,
      deliveryTerms: 'SEPARATE',
      parts: [{ householdId: 'household-a', quantity: 5000, unitPriceVnd: 30_000 }],
    });
  });

  it('rejects a completion date outside the window and a non-positive price', () => {
    for (const completionDate of [deadline, new Date('2027-03-01T00:00:00.000Z')]) {
      const result = assembleDirectQuotation({ ...draft, completionDate });
      expect(!result.ok && result.error.code).toBe('COMPLETION_DATE_INVALID');
    }
    const free = assembleDirectQuotation({ ...draft, unitPriceVnd: 0 });
    expect(!free.ok && free.error.code).toBe('QUOTATION_INPUT_INVALID');
  });
});
