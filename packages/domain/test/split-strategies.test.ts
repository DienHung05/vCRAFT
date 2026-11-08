import { describe, expect, it } from 'vitest';
import {
  isWithinCapacity,
  proposeSplit,
  SPLIT_STRATEGIES,
  type SplitOffer,
  type SplitProposal,
  type SplitStrategy,
  splitCeiling,
} from '../src';

const request = {
  quantity: 5000,
  biddingClosesAt: new Date('2027-01-10T00:00:00.000Z'),
  requiredBy: new Date('2027-02-10T00:00:00.000Z'),
};

const day = (n: number) => new Date(Date.UTC(2027, 1, n));

const offer = (
  householdId: string,
  maxQuantity: number,
  unitPriceVnd: number,
  completion = day(1),
  capacity?: number | null,
): SplitOffer => ({
  householdId,
  maxQuantity,
  unitPriceVnd,
  completionDate: completion,
  capacity,
});

/** AC-3: four households with capacities 2000 / 1500 / 1200 / 1000 for a 5000-unit request. */
const ac3 = [
  offer('a', 2000, 30_000, day(1), 2000),
  offer('b', 1500, 32_000, day(2), 1500),
  offer('c', 1200, 34_000, day(3), 1200),
  offer('d', 1000, 36_000, day(4), 1000),
];

const propose = (strategy: SplitStrategy, offers: readonly SplitOffer[], quantity = 5000) => {
  const result = proposeSplit(strategy, { ...request, quantity }, offers);
  if (!result.ok) throw new Error(`unexpected ${result.error.code}`);
  return result.value;
};

const quantities = (proposal: SplitProposal) => proposal.allocations.map((a) => a.quantity);

describe('proposeSplit: capacity strategy (Hamilton)', () => {
  it('reproduces AC-3: 1754 / 1316 / 1053 / 877 for capacities 2000 / 1500 / 1200 / 1000', () => {
    const proposal = propose('CAPACITY', ac3);
    expect(quantities(proposal)).toEqual([1754, 1316, 1053, 877]);
    expect(proposal).toMatchObject({ totalQuantity: 5000, shortfall: 0, complete: true });
  });

  it('gives leftover units to the largest remainders and keeps exact shares exact', () => {
    // 10 over weights 3 / 3 / 4: exact 3 / 3 / 4, nothing left over.
    const exact = propose(
      'CAPACITY',
      [offer('a', 10, 1, day(1), 3), offer('b', 10, 1, day(1), 3), offer('c', 10, 1, day(1), 4)],
      10,
    );
    expect(quantities(exact)).toEqual([3, 3, 4]);
    // 10 over weights 5 / 3 / 2 with 7: exact 3.5 / 2.1 / 1.4 -> floors 3 / 2 / 1, leftover 1 to the 0.5 remainder.
    const remainder = propose(
      'CAPACITY',
      [offer('a', 10, 1, day(1), 5), offer('b', 10, 1, day(1), 3), offer('c', 10, 1, day(1), 2)],
      7,
    );
    expect(quantities(remainder)).toEqual([4, 2, 1]);
  });

  it('breaks equal remainders by the heavier capacity, then by the offer priority', () => {
    // 5 over equal weights: 1 each and two leftovers with equal remainders.
    const tie = propose('CAPACITY', [offer('a', 3, 1), offer('b', 3, 1), offer('c', 3, 1)], 5);
    expect(tie.totalQuantity).toBe(5);
    expect([...quantities(tie)].sort()).toEqual([1, 2, 2]);
    // Remainders 0.5 and 0.5: the heavier weight (cap 3, ceiling 3) wins the extra unit over weight 1.
    const heavier = propose(
      'CAPACITY',
      [offer('light', 10, 1, day(1), 1), offer('heavy', 10, 1, day(1), 3)],
      2,
    );
    expect(quantities(heavier)).toEqual([0, 2]);
  });

  it('is deterministic: the same input gives the same plan whatever the input order', () => {
    const forward = propose('CAPACITY', ac3);
    const reversed = propose('CAPACITY', [...ac3].reverse());
    const byId = (p: SplitProposal) =>
      Object.fromEntries(p.allocations.map((a) => [a.householdId, a.quantity]));
    expect(byId(reversed)).toEqual(byId(forward));
  });

  it('caps a household at its offered maximum and shares the rest among the others', () => {
    // Capacity 2000 would take 1754, but it only offered 1000: the 754 left is shared by the other three.
    const offers = [offer('a', 1000, 30_000, day(1), 2000), ...ac3.slice(1)];
    const proposal = propose('CAPACITY', offers, 4000);
    expect(proposal.allocations[0]?.quantity).toBe(1000);
    expect(proposal.totalQuantity).toBe(4000);
    expect(quantities(proposal).every((q, i) => q <= (offers[i]?.maxQuantity ?? 0))).toBe(true);
  });

  it('weights by the offer when a household declared no capacity', () => {
    const proposal = propose('CAPACITY', [offer('a', 3000, 1), offer('b', 1000, 1)], 2000);
    expect(quantities(proposal)).toEqual([1500, 500]);
  });
});

describe('proposeSplit: cheapest strategy', () => {
  it('fills the lowest unit price first up to each ceiling', () => {
    const offers = [
      offer('dear', 3000, 40_000),
      offer('cheap', 2000, 30_000),
      offer('mid', 2000, 35_000),
    ];
    const proposal = propose('CHEAPEST', offers);
    expect(quantities(proposal)).toEqual([1000, 2000, 2000]);
    expect(proposal.productionTotalVnd).toBe(1000 * 40_000 + 2000 * 30_000 + 2000 * 35_000);
  });

  it('breaks a price tie by the earlier completion date, then the larger ceiling, then the id', () => {
    const early = propose('CHEAPEST', [
      offer('late', 5000, 10, day(5)),
      offer('early', 5000, 10, day(2)),
    ]);
    expect(quantities(early)).toEqual([0, 5000]);
    const bigger = propose('CHEAPEST', [
      offer('small', 5000, 10, day(2), 3000),
      offer('large', 5000, 10, day(2)),
    ]);
    expect(quantities(bigger)).toEqual([0, 5000]);
    const byId = propose('CHEAPEST', [offer('z', 5000, 10), offer('a', 5000, 10)]);
    expect(quantities(byId)).toEqual([0, 5000]);
  });

  it('respects the declared capacity below the offered maximum', () => {
    const proposal = propose('CHEAPEST', [
      offer('cheap', 5000, 10, day(1), 1500),
      offer('dear', 5000, 20),
    ]);
    expect(quantities(proposal)).toEqual([1500, 3500]);
  });
});

describe('proposeSplit: balanced strategy', () => {
  it('splits equally with the leftover units spread one each', () => {
    const proposal = propose(
      'BALANCED',
      [offer('a', 5000, 1), offer('b', 5000, 1), offer('c', 5000, 1)],
      5000,
    );
    expect(proposal.totalQuantity).toBe(5000);
    expect([...quantities(proposal)].sort((x, y) => y - x)).toEqual([1667, 1667, 1666]);
  });

  it('caps a small household and lets the others carry the difference', () => {
    const proposal = propose(
      'BALANCED',
      [offer('a', 300, 1), offer('b', 5000, 1), offer('c', 5000, 1)],
      5000,
    );
    expect(quantities(proposal)).toEqual([300, 2350, 2350]);
  });

  it('never gives a leftover unit to a household already at its ceiling', () => {
    // 7 over three households: base 2, one extra unit; the household capped at 2 cannot take it.
    const proposal = propose(
      'BALANCED',
      [offer('a', 2, 1), offer('b', 10, 1), offer('c', 10, 1)],
      7,
    );
    expect(quantities(proposal)[0]).toBe(2);
    expect(proposal.totalQuantity).toBe(7);
    expect([...quantities(proposal)].slice(1).sort()).toEqual([2, 3]);
  });
});

describe('proposeSplit: ceilings, shortfall and eligibility', () => {
  it.each(SPLIT_STRATEGIES)(
    '%s never goes above any ceiling and sums to the request when it fits',
    (strategy) => {
      const offers = [
        offer('a', 1800, 31_000, day(1), 1500),
        offer('b', 900, 29_000, day(2), 2000),
        offer('c', 2600, 33_000, day(3), null),
        offer('d', 1200, 35_000, day(4), 1100),
      ];
      const proposal = propose(strategy, offers);
      expect(proposal.totalQuantity).toBe(5000);
      offers.forEach((o, i) => {
        expect(quantities(proposal)[i]).toBeLessThanOrEqual(splitCeiling(o));
      });
    },
  );

  it.each(SPLIT_STRATEGIES)(
    '%s reports a shortfall and proposes every ceiling when the households cannot cover the request',
    (strategy) => {
      const proposal = propose(strategy, [offer('a', 1000, 1, day(1), 800), offer('b', 700, 1)]);
      expect(quantities(proposal)).toEqual([800, 700]);
      expect(proposal).toMatchObject({ totalQuantity: 1500, shortfall: 3500, complete: false });
    },
  );

  it('keeps a household that declared zero capacity at zero and lists it as excluded', () => {
    const proposal = propose('CAPACITY', [
      offer('opted-out', 5000, 1, day(1), 0),
      offer('b', 6000, 1),
    ]);
    expect(quantities(proposal)).toEqual([0, 5000]);
    expect(proposal.excluded).toEqual(['opted-out']);
  });

  it('excludes offers whose completion date misses the window or whose price is invalid', () => {
    const proposal = propose('CHEAPEST', [
      offer('too-late', 5000, 1, new Date('2027-03-01T00:00:00.000Z')),
      offer('too-early', 5000, 1, request.biddingClosesAt),
      offer('free', 5000, 0),
      offer('ok', 5000, 9),
    ]);
    expect(quantities(proposal)).toEqual([0, 0, 0, 5000]);
    expect(proposal.excluded).toEqual(['too-late', 'too-early', 'free']);
  });

  it('allows the delivery deadline itself as a completion date', () => {
    const proposal = propose('BALANCED', [offer('edge', 5000, 1, request.requiredBy)]);
    expect(quantities(proposal)).toEqual([5000]);
  });

  it('reports the latest completion date among the households that got a share and the production total', () => {
    const offers = [
      offer('a', 3000, 10, day(2)),
      offer('b', 3000, 20, day(8)),
      offer('c', 3000, 30, day(5)),
    ];
    const cheapest = propose('CHEAPEST', offers, 4000);
    expect(quantities(cheapest)).toEqual([3000, 1000, 0]);
    expect(cheapest.estimatedCompletion).toEqual(day(8));
    expect(cheapest.productionTotalVnd).toBe(3000 * 10 + 1000 * 20);
    const small = propose('CHEAPEST', offers, 2000);
    expect(small.estimatedCompletion).toEqual(day(2));
  });

  it('has no estimated completion when nobody is usable', () => {
    const proposal = propose('CAPACITY', [offer('a', 100, 1, day(1), 0)]);
    expect(proposal.estimatedCompletion).toBeNull();
    expect(proposal.shortfall).toBe(5000);
  });

  it('returns one allocation per input offer in input order, with the offer price and date', () => {
    const proposal = propose('CAPACITY', ac3);
    expect(proposal.allocations.map((a) => a.householdId)).toEqual(['a', 'b', 'c', 'd']);
    expect(proposal.allocations[2]).toMatchObject({ unitPriceVnd: 34_000, completionDate: day(3) });
  });

  it('handles very large quantities exactly', () => {
    const big = 2_147_483_647;
    const proposal = propose(
      'CAPACITY',
      [offer('a', big, 1, day(1), big), offer('b', big, 1, day(1), big)],
      big,
    );
    expect(proposal.totalQuantity).toBe(big);
    expect([...quantities(proposal)].sort()).toEqual([1_073_741_823, 1_073_741_824]);
  });

  it('rejects invalid input', () => {
    const code = (r: ReturnType<typeof proposeSplit>) => (r.ok ? 'ok' : r.error.code);
    expect(code(proposeSplit('CAPACITY', { ...request, quantity: 0 }, ac3))).toBe(
      'SPLIT_INPUT_INVALID',
    );
    expect(code(proposeSplit('CAPACITY', { ...request, quantity: 10.5 }, ac3))).toBe(
      'SPLIT_INPUT_INVALID',
    );
    expect(
      code(proposeSplit('CAPACITY', { ...request, requiredBy: request.biddingClosesAt }, ac3)),
    ).toBe('SPLIT_INPUT_INVALID');
    expect(
      code(proposeSplit('CAPACITY', request, [ac3[0] as SplitOffer, ac3[0] as SplitOffer])),
    ).toBe('SPLIT_INPUT_INVALID');
    expect(code(proposeSplit('NOPE' as SplitStrategy, request, ac3))).toBe('SPLIT_INPUT_INVALID');
  });
});

describe('splitCeiling and isWithinCapacity', () => {
  it('lowers the offered maximum to the declared capacity', () => {
    expect(splitCeiling({ maxQuantity: 5000, capacity: 1000 })).toBe(1000);
    expect(splitCeiling({ maxQuantity: 500, capacity: 1000 })).toBe(500);
    expect(splitCeiling({ maxQuantity: 500, capacity: null })).toBe(500);
    expect(splitCeiling({ maxQuantity: 500, capacity: 0 })).toBe(0);
    expect(splitCeiling({ maxQuantity: 12.5 })).toBe(0);
  });

  it('treats an undeclared capacity as unlimited and zero as opted out', () => {
    expect(isWithinCapacity(1000, 1000)).toBe(true);
    expect(isWithinCapacity(1001, 1000)).toBe(false);
    expect(isWithinCapacity(1, 0)).toBe(false);
    expect(isWithinCapacity(5000, undefined)).toBe(true);
    expect(isWithinCapacity(5000, null)).toBe(true);
  });
});
