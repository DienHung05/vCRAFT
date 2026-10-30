import { describe, expect, it } from 'vitest';
import { checkProgressReport } from '../src';

describe('checkProgressReport (GH#11)', () => {
  it('completed within 0..allocated is accepted', () => {
    expect(checkProgressReport(10, 0).ok).toBe(true);
    expect(checkProgressReport(10, 7).ok).toBe(true);
    expect(checkProgressReport(10, 10).ok).toBe(true);
  });

  it('completed above allocated is refused', () => {
    expect(checkProgressReport(10, 11).ok).toBe(false);
  });

  it('negative completed is refused', () => {
    expect(checkProgressReport(10, -1).ok).toBe(false);
  });

  it.each([
    ['NaN', Number.NaN],
    ['Infinity', Number.POSITIVE_INFINITY],
    ['fraction', 2.5],
  ] as const)('completed %s is refused', (_name, completedQty) => {
    expect(checkProgressReport(10, completedQty).ok).toBe(false);
  });

  it.each([[0], [-3], [Number.NaN]])('quantity %s is never reportable', (quantity) => {
    expect(checkProgressReport(quantity, 0).ok).toBe(false);
  });
});
