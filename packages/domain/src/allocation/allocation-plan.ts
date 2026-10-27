/** Một phần trong phương án chia đơn: số lượng giao cho một hộ và năng lực còn trống của hộ đó. */
export interface AllocationPlanPart {
  readonly quantity: number;
  readonly capacity: number;
}

export interface AllocationPlanCheck {
  /** Σ số lượng các phần. */
  readonly sum: number;
  /** Số lượng yêu cầu − Σ: dương là còn thiếu, âm là thừa. */
  readonly remaining: number;
  /** Chỉ số các phần vượt năng lực còn trống. */
  readonly overCapacity: readonly number[];
  /** Chỉ số các phần có số lượng không phải số nguyên dương hoặc 0. */
  readonly invalid: readonly number[];
  /** Phương án lưu được: Σ = tổng, không phần nào vượt năng lực, không phần nào sai. */
  readonly ok: boolean;
}

/**
 * Kiểm bất biến BR-L6 cho phương án chia đơn (FR-ORD-03): Σ số lượng = số lượng yêu cầu và mỗi
 * phần ≤ năng lực còn trống. Chỉ truyền các phần đang hiệu lực (bỏ `DECLINED`/`CANCELLED`).
 * Dùng chung cho màn Chia đơn (hiển thị) và backend (cưỡng chế trước khi flush).
 */
export function checkAllocationPlan(
  required: number,
  parts: readonly AllocationPlanPart[],
): AllocationPlanCheck {
  let sum = 0;
  const overCapacity: number[] = [];
  const invalid: number[] = [];
  parts.forEach((part, i) => {
    if (!Number.isInteger(part.quantity) || part.quantity < 0) {
      invalid.push(i);
      return;
    }
    sum += part.quantity;
    if (part.quantity > part.capacity) overCapacity.push(i);
  });
  const remaining = required - sum;
  return {
    sum,
    remaining,
    overCapacity,
    invalid,
    ok: remaining === 0 && overCapacity.length === 0 && invalid.length === 0,
  };
}
