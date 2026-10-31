import { DomainError } from '../shared/domain-error';
import { createStateMachine, type TransitionTable } from '../shared/state-machine';

/**
 * Máy trạng thái Hộ sản xuất (GLOSSARY: Household approval, Suspension; vCRAFT-9hg.3).
 *
 * - `PENDING_REVIEW`: hộ đã nộp hồ sơ, chưa có gì công khai.
 * - `APPROVED`: Ban quản lý chấp nhận hộ ⇒ hồ sơ, xưởng, sản phẩm đã xuất bản hiện công khai.
 * - `REJECTED`: từ chối hồ sơ, không có gì công khai.
 * - `SUSPENDED`: ẩn toàn bộ hiện diện công khai nhưng giữ nguyên bản ghi riêng; QR hiện thông báo
 *   "không còn trưng bày". Tạm ngừng KHÔNG khóa tài khoản người đại diện.
 *
 * Mọi chuyển trạng thái do Quản trị viên làng thực hiện.
 */
export const HOUSEHOLD_STATUSES = ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'SUSPENDED'] as const;
export type HouseholdStatus = (typeof HOUSEHOLD_STATUSES)[number];

export const HOUSEHOLD_EVENTS = [
  'APPROVE',
  'REJECT',
  'REQUEST_INFO',
  'SUSPEND',
  'REINSTATE',
] as const;
export type HouseholdEvent = (typeof HOUSEHOLD_EVENTS)[number];

export type HouseholdGuardCode = 'FORBIDDEN_ACTOR' | 'REASON_REQUIRED';

export type AccountRole = 'ADMIN' | 'HOUSEHOLD' | 'BUYER';

export interface HouseholdContext {
  readonly actorRole: AccountRole;
  /** Lý do bắt buộc khi từ chối hoặc tạm ngừng (hiện cho người đại diện, không công khai). */
  readonly reason?: string | undefined;
}

function adminOnly(ctx: HouseholdContext): DomainError<HouseholdGuardCode> | undefined {
  return ctx.actorRole === 'ADMIN'
    ? undefined
    : new DomainError(
        'FORBIDDEN_ACTOR',
        'only a village administrator may change household status',
      );
}

function reasonRequired(ctx: HouseholdContext): DomainError<HouseholdGuardCode> | undefined {
  return ctx.reason !== undefined && ctx.reason.trim().length > 0
    ? undefined
    : new DomainError('REASON_REQUIRED', 'a reason is required');
}

export const HOUSEHOLD_TRANSITIONS = {
  PENDING_REVIEW: {
    APPROVE: { to: 'APPROVED', guards: [adminOnly] },
    REJECT: { to: 'REJECTED', guards: [adminOnly], inputGuards: [reasonRequired] },
    // Yêu cầu bổ sung (FR-ADM-03): hồ sơ vẫn chờ duyệt, hộ đọc lý do rồi bổ sung.
    REQUEST_INFO: { to: 'PENDING_REVIEW', guards: [adminOnly], inputGuards: [reasonRequired] },
  },
  APPROVED: {
    SUSPEND: { to: 'SUSPENDED', guards: [adminOnly], inputGuards: [reasonRequired] },
  },
  SUSPENDED: {
    REINSTATE: { to: 'APPROVED', guards: [adminOnly] },
  },
  REJECTED: {},
} as const satisfies TransitionTable<
  HouseholdStatus,
  HouseholdEvent,
  HouseholdContext,
  HouseholdGuardCode
>;

const householdMachine = createStateMachine<
  HouseholdStatus,
  HouseholdEvent,
  HouseholdContext,
  HouseholdGuardCode
>({
  name: 'Household',
  states: HOUSEHOLD_STATUSES,
  events: HOUSEHOLD_EVENTS,
  table: HOUSEHOLD_TRANSITIONS,
});

export const householdTransition = householdMachine.transition;
export const availableHouseholdEvents = householdMachine.availableEvents;
export const householdStructuralNext = householdMachine.structuralNext;
export const isHouseholdTerminal = householdMachine.isTerminal;

/** Hộ có hiện diện công khai (hồ sơ, xưởng, sản phẩm đã xuất bản) hay không. */
export function isHouseholdPublic(status: HouseholdStatus): boolean {
  return status === 'APPROVED';
}
