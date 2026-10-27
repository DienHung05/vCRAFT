import { availableEvents, type RfqEvent, type RfqStatus, transition } from '@vcraft/domain';

/** Các chặng "công đoạn lò" của đường đi chính (FR-RFQ-12, SRS §4.1). */
export const RFQ_MAIN_STEPS = [
  'DRAFT',
  'SENT',
  'BIDDING',
  'ACCEPTED',
  'IN_PRODUCTION',
  'DELIVERED',
] as const satisfies readonly RfqStatus[];

export interface RfqStepperModel {
  /** Mã trạng thái của từng chặng; chặng dừng (hủy/hết hạn) thay cho chặng nó dừng ở. */
  steps: RfqStatus[];
  current: number;
  halted: boolean;
}

/**
 * Chuyển trạng thái RFQ sang mô hình cho `Stepper`. `CANCELLED`/`EXPIRED` không nằm trên đường đi chính:
 * dừng ở `SENT` nếu chưa có chào giá, ngược lại dừng ở `BIDDING`, và nhãn chặng đó đổi thành trạng thái dừng.
 */
export function rfqStepperModel(status: RfqStatus, hasBids: boolean): RfqStepperModel {
  const steps: RfqStatus[] = [...RFQ_MAIN_STEPS];
  if (status === 'CANCELLED' || status === 'EXPIRED') {
    const at = hasBids ? RFQ_MAIN_STEPS.indexOf('BIDDING') : RFQ_MAIN_STEPS.indexOf('SENT');
    steps.splice(at, steps.length - at, status);
    return { steps, current: at, halted: true };
  }
  return { steps, current: RFQ_MAIN_STEPS.indexOf(status), halted: false };
}

/**
 * Sự kiện Buyer chủ RFQ được thực hiện ở `status` (FR-RFQ-12): lấy từ cùng máy trạng thái với backend,
 * bỏ sự kiện của tác nhân khác (`ACTOR_NOT_ALLOWED`). Thiếu dữ kiện nhập (`MISSING_CONTEXT`…) vẫn giữ,
 * vì nút phải hiện trước khi người dùng nhập xong.
 */
export function buyerEvents(status: RfqStatus): RfqEvent[] {
  return availableEvents(status).filter((event) => {
    const result = transition(status, event, { actor: 'BUYER_OWNER' });
    return result.ok || result.error.code !== 'ACTOR_NOT_ALLOWED';
  });
}
