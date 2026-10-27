import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { checkAllocationPlan } from '../src';

describe('checkAllocationPlan (BR-L6)', () => {
  it('Σ = tổng, trong năng lực ⇒ hợp lệ', () => {
    const r = checkAllocationPlan(3000, [
      { quantity: 1200, capacity: 1500 },
      { quantity: 1000, capacity: 1000 },
      { quantity: 800, capacity: 900 },
    ]);
    expect(r).toEqual({ sum: 3000, remaining: 0, overCapacity: [], invalid: [], ok: true });
  });

  it('còn thiếu ⇒ remaining dương, không hợp lệ', () => {
    const r = checkAllocationPlan(3000, [{ quantity: 2500, capacity: 3000 }]);
    expect(r.remaining).toBe(500);
    expect(r.ok).toBe(false);
  });

  it('thừa ⇒ remaining âm, không hợp lệ', () => {
    const r = checkAllocationPlan(1000, [
      { quantity: 600, capacity: 800 },
      { quantity: 500, capacity: 800 },
    ]);
    expect(r.remaining).toBe(-100);
    expect(r.ok).toBe(false);
  });

  it('vượt năng lực ⇒ báo đúng chỉ số', () => {
    const r = checkAllocationPlan(1000, [
      { quantity: 400, capacity: 800 },
      { quantity: 600, capacity: 500 },
    ]);
    expect(r.overCapacity).toEqual([1]);
    expect(r.ok).toBe(false);
  });

  it('số lượng âm hoặc lẻ ⇒ invalid, không cộng vào tổng', () => {
    const r = checkAllocationPlan(100, [
      { quantity: -5, capacity: 100 },
      { quantity: 2.5, capacity: 100 },
      { quantity: 100, capacity: 100 },
    ]);
    expect(r.invalid).toEqual([0, 1]);
    expect(r.sum).toBe(100);
    expect(r.ok).toBe(false);
  });

  it('ok ⇔ Σ = tổng và mọi phần ≤ năng lực', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000 }),
        fc.array(fc.record({ quantity: fc.nat({ max: 5000 }), capacity: fc.nat({ max: 5000 }) }), {
          maxLength: 8,
        }),
        (required, parts) => {
          const r = checkAllocationPlan(required, parts);
          const sum = parts.reduce((s, p) => s + p.quantity, 0);
          const fits = parts.every((p) => p.quantity <= p.capacity);
          expect(r.ok).toBe(sum === required && fits);
        },
      ),
    );
  });
});
