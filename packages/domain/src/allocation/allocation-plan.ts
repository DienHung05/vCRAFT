/** Một phần trong phương án chia đơn: số lượng giao cho một hộ và năng lực còn trống của hộ đó. */
export interface AllocationPlanPart {
  readonly quantity: number;
  readonly capacity: number;
}

/**
 * BR-L6: whether a quantity fits a household's declared capacity. A household that declared none
 * (null/undefined) is not capped here; one that declared 0 opted out and takes nothing.
 */
export function isWithinCapacity(quantity: number, capacity: number | null | undefined): boolean {
  if (capacity === null || capacity === undefined) return true;
  return Number.isFinite(capacity) && quantity <= capacity;
}

export interface AllocationPlanCheck {
  /** Σ số lượng các phần. */
  readonly sum: number;
  /** Số lượng yêu cầu − Σ: dương là còn thiếu, âm là thừa. */
  readonly remaining: number;
  /** Chỉ số các phần vượt năng lực còn trống. */
  readonly overCapacity: readonly number[];
  /**
   * Chỉ số các phần sai dữ liệu: số lượng không phải số nguyên ≥ 0, hoặc năng lực không phải số nguyên
   * hữu hạn ≥ 0 (NaN, ±Infinity, âm, lẻ). Phần sai không được cộng vào Σ và không xét vượt năng lực.
   */
  readonly invalid: readonly number[];
  /** Số lượng yêu cầu hợp lệ: hữu hạn và > 0. Sai ⇒ phương án không bao giờ `ok`. */
  readonly requiredValid: boolean;
  /** Phương án lưu được: yêu cầu hợp lệ, Σ = tổng, không phần nào vượt năng lực, không phần nào sai. */
  readonly ok: boolean;
}

/**
 * Kiểm bất biến BR-L6 cho phương án chia đơn (FR-ORD-03): Σ số lượng = số lượng yêu cầu và mỗi
 * phần ≤ năng lực còn trống. Chỉ truyền các phần đang hiệu lực (bỏ `DECLINED`/`CANCELLED`).
 * Dữ liệu không hữu hạn/âm/lẻ bị từ chối (không để NaN lọt qua phép so sánh).
 * Dùng chung cho màn Chia đơn (hiển thị) và backend (cưỡng chế trước khi flush).
 */
export function checkAllocationPlan(
  required: number,
  parts: readonly AllocationPlanPart[],
): AllocationPlanCheck {
  const requiredValid = Number.isFinite(required) && required > 0;
  let sum = 0;
  const overCapacity: number[] = [];
  const invalid: number[] = [];
  parts.forEach((part, i) => {
    const validQuantity = Number.isInteger(part.quantity) && part.quantity >= 0;
    const validCapacity = Number.isInteger(part.capacity) && part.capacity >= 0;
    if (!validQuantity || !validCapacity) {
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
    requiredValid,
    ok: requiredValid && remaining === 0 && overCapacity.length === 0 && invalid.length === 0,
  };
}

export interface ProgressReportCheck {
  readonly quantity: number;
  readonly completedQty: number;
  readonly ok: boolean;
}

/**
 * GH#11: báo cáo tiến độ theo phân bổ. Số lượng đã xong phải là số nguyên
 * trong khoảng 0..số lượng được giao; ngoài khoảng ⇒ service từ chối.
 */
export function checkProgressReport(quantity: number, completedQty: number): ProgressReportCheck {
  const ok =
    Number.isInteger(quantity) &&
    quantity >= 1 &&
    Number.isInteger(completedQty) &&
    completedQty >= 0 &&
    completedQty <= quantity;
  return { quantity, completedQty, ok };
}
