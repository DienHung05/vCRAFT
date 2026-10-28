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
    expect(r).toEqual({
      sum: 3000,
      remaining: 0,
      overCapacity: [],
      invalid: [],
      requiredValid: true,
      ok: true,
    });
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

  describe('dữ liệu không hợp lệ không được lọt qua (hồi quy)', () => {
    it.each([
      ['NaN', Number.NaN],
      ['+Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['âm', -1],
      ['lẻ', 1.5],
    ])('năng lực %s ⇒ phần bị đánh dấu invalid, phương án không ok', (_name, capacity) => {
      const r = checkAllocationPlan(10, [{ quantity: 10, capacity }]);
      expect(r.invalid).toEqual([0]);
      expect(r.overCapacity).toEqual([]);
      expect(r.ok).toBe(false);
    });

    it('chỉ phần sai bị đánh dấu, các phần hợp lệ vẫn được tính', () => {
      const r = checkAllocationPlan(10, [
        { quantity: 4, capacity: 5 },
        { quantity: 6, capacity: Number.NaN },
      ]);
      expect(r.invalid).toEqual([1]);
      expect(r.sum).toBe(4);
      expect(r.ok).toBe(false);
    });

    it('số lượng NaN/Infinity ⇒ invalid', () => {
      const r = checkAllocationPlan(10, [
        { quantity: Number.NaN, capacity: 10 },
        { quantity: Number.POSITIVE_INFINITY, capacity: 10 },
      ]);
      expect(r.invalid).toEqual([0, 1]);
      expect(r.ok).toBe(false);
    });

    it.each([
      ['NaN', Number.NaN],
      ['+Infinity', Number.POSITIVE_INFINITY],
      ['-Infinity', Number.NEGATIVE_INFINITY],
      ['0', 0],
      ['âm', -5],
    ])('tổng yêu cầu %s ⇒ requiredValid=false, không ok', (_name, required) => {
      const r = checkAllocationPlan(required, [{ quantity: 0, capacity: 10 }]);
      expect(r.requiredValid).toBe(false);
      expect(r.ok).toBe(false);
    });

    it('tổng yêu cầu 0 và không có phần nào vẫn không ok', () => {
      expect(checkAllocationPlan(0, []).ok).toBe(false);
    });

    it('năng lực 0 hợp lệ (hộ hết chỗ) nhưng nhận số lượng > 0 ⇒ vượt năng lực', () => {
      const r = checkAllocationPlan(5, [{ quantity: 5, capacity: 0 }]);
      expect(r.invalid).toEqual([]);
      expect(r.overCapacity).toEqual([0]);
    });

    it('property: giá trị bất kỳ (kể cả NaN/Infinity) ⇒ ok chỉ khi mọi số đều hữu hạn', () => {
      const num = fc.oneof(
        fc.integer({ min: -5, max: 50 }),
        fc.double({ noDefaultInfinity: false, noNaN: false }),
      );
      fc.assert(
        fc.property(
          num,
          fc.array(fc.record({ quantity: num, capacity: num }), { maxLength: 5 }),
          (required, parts) => {
            const r = checkAllocationPlan(required, parts);
            if (r.ok) {
              expect(Number.isFinite(required) && required > 0).toBe(true);
              for (const p of parts) {
                expect(Number.isInteger(p.quantity) && p.quantity >= 0).toBe(true);
                expect(Number.isInteger(p.capacity) && p.capacity >= 0).toBe(true);
                expect(p.quantity).toBeLessThanOrEqual(p.capacity);
              }
              expect(Number.isFinite(r.sum)).toBe(true);
            }
          },
        ),
      );
    });
  });

  it('ok ⇔ Σ = tổng và mọi phần ≤ năng lực', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10_000 }),
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
