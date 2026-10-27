import { DomainError } from '../shared/domain-error';
import { createStateMachine, type TransitionTable } from '../shared/state-machine';

/** Máy trạng thái Phân bổ (SRS §4.3). Phân bổ sinh ra ở `PROPOSED` khi Buyer chốt chào giá. */
export const ALLOCATION_STATUSES = [
  'PROPOSED',
  'CONFIRMED',
  'DECLINED',
  'IN_PROGRESS',
  'DONE',
  'CANCELLED',
] as const;
export type AllocationStatus = (typeof ALLOCATION_STATUSES)[number];

export const ALLOCATION_EVENTS = ['CONFIRM', 'DECLINE', 'START', 'COMPLETE', 'CANCEL'] as const;
export type AllocationEvent = (typeof ALLOCATION_EVENTS)[number];

export type AllocationGuardCode = 'MISSING_CONTEXT' | 'ALLOCATION_NOT_COMPLETE';

export interface AllocationContext {
  readonly quantity?: number | undefined;
  readonly completedQty?: number | undefined;
}

/** FR-ORD-06/07: chỉ hoàn tất khi số lượng đã xong bằng số lượng được giao. */
function completedAllQuantity(
  ctx: AllocationContext,
): DomainError<AllocationGuardCode> | undefined {
  if (ctx.quantity === undefined || ctx.completedQty === undefined) {
    return new DomainError('MISSING_CONTEXT', 'quantity and completedQty are required');
  }
  if (ctx.completedQty !== ctx.quantity) {
    return new DomainError('ALLOCATION_NOT_COMPLETE', 'completedQty must equal quantity', {
      quantity: ctx.quantity,
      completedQty: ctx.completedQty,
    });
  }
  return undefined;
}

export const ALLOCATION_TRANSITIONS = {
  PROPOSED: {
    CONFIRM: { to: 'CONFIRMED' },
    DECLINE: { to: 'DECLINED' },
    CANCEL: { to: 'CANCELLED' },
  },
  CONFIRMED: {
    START: { to: 'IN_PROGRESS' }, // kích hoạt bởi RFQ START_PRODUCTION (T4)
    CANCEL: { to: 'CANCELLED' },
  },
  IN_PROGRESS: {
    COMPLETE: { to: 'DONE', guards: [completedAllQuantity] },
    CANCEL: { to: 'CANCELLED' }, // chia lại (FR-ORD-09)
  },
  DECLINED: {},
  DONE: {},
  CANCELLED: {},
} as const satisfies TransitionTable<
  AllocationStatus,
  AllocationEvent,
  AllocationContext,
  AllocationGuardCode
>;

const allocationMachine = createStateMachine<
  AllocationStatus,
  AllocationEvent,
  AllocationContext,
  AllocationGuardCode
>({
  name: 'Allocation',
  states: ALLOCATION_STATUSES,
  events: ALLOCATION_EVENTS,
  table: ALLOCATION_TRANSITIONS,
});

export const allocationTransition = allocationMachine.transition;
export const availableAllocationEvents = allocationMachine.availableEvents;
export const isAllocationTerminal = allocationMachine.isTerminal;
