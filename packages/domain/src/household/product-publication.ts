import { DomainError } from '../shared/domain-error';
import { createStateMachine, type TransitionTable } from '../shared/state-machine';
import type { AccountRole, HouseholdStatus } from './household-state-machine';

/**
 * Xuất bản Sản phẩm (vCRAFT-9hg.3, 9hg.4): nhật ký chỉ hiện cùng sản phẩm đã xuất bản và bị rút cùng nó.
 *
 * - `DRAFT`: chưa công khai; mã QR (nếu đã in) dẫn tới trang "không tìm thấy".
 * - `PUBLISHED`: công khai khi hộ đang `APPROVED`.
 * - `WITHDRAWN`: rút một sản phẩm và nhật ký của nó; QR hiện thông báo "không còn trưng bày".
 *   This is the SRS `ARCHIVED` state (FR-PRD-01): the stored value stays `WITHDRAWN` to avoid a data
 *   migration, and the UI labels it "Lưu trữ" / "Archived".
 * - `SOLD`: a one-of-a-kind product (`kind = OBJECT`, "Độc bản") that found its buyer. It stays public
 *   (page, trace page and journal keep working) with a "Đã bán" / "Sold" badge, but it is no longer
 *   counted as in stock and nobody can start a quotation request from it. `PUBLISHED` and `SOLD`
 *   switch both ways, so a mistaken click is undone.
 */
export const PRODUCT_STATUSES = ['DRAFT', 'PUBLISHED', 'SOLD', 'WITHDRAWN'] as const;
export type ProductStatus = (typeof PRODUCT_STATUSES)[number];

export const PRODUCT_EVENTS = [
  'PUBLISH',
  'WITHDRAW',
  'REPUBLISH',
  'MARK_SOLD',
  'BACK_ON_SALE',
] as const;
export type ProductEvent = (typeof PRODUCT_EVENTS)[number];

export type ProductGuardCode =
  | 'FORBIDDEN_ACTOR'
  | 'HOUSEHOLD_NOT_APPROVED'
  | 'REASON_REQUIRED'
  | 'NOT_ONE_OF_A_KIND';

/** Product kinds the lifecycle cares about; mirrors the database `ProductKind`. */
export type ProductLifecycleKind = 'OBJECT' | 'BATCH';

export interface ProductContext {
  readonly actorRole: AccountRole;
  /** Người tác động có phải người đại diện của hộ sở hữu sản phẩm không. */
  readonly isOwner: boolean;
  readonly householdStatus: HouseholdStatus;
  readonly reason?: string | undefined;
  /** Required by `MARK_SOLD`: only a one-of-a-kind (`OBJECT`) product can be sold. */
  readonly kind?: ProductLifecycleKind | undefined;
}

/** Người đại diện hộ xuất bản sản phẩm của mình; Ban quản lý chỉ được rút (ẩn), không xuất bản thay hộ. */
function ownerOnly(ctx: ProductContext): DomainError<ProductGuardCode> | undefined {
  return ctx.actorRole === 'HOUSEHOLD' && ctx.isOwner
    ? undefined
    : new DomainError('FORBIDDEN_ACTOR', 'only the household representative may publish');
}

function ownerOrAdmin(ctx: ProductContext): DomainError<ProductGuardCode> | undefined {
  return ctx.actorRole === 'ADMIN' || (ctx.actorRole === 'HOUSEHOLD' && ctx.isOwner)
    ? undefined
    : new DomainError('FORBIDDEN_ACTOR', 'only the owner or an administrator may withdraw');
}

/** Only a single object ("Độc bản") can be marked sold; a batch is tracked through its stock. */
function oneOfAKind(ctx: ProductContext): DomainError<ProductGuardCode> | undefined {
  return ctx.kind === 'OBJECT'
    ? undefined
    : new DomainError('NOT_ONE_OF_A_KIND', 'only a one-of-a-kind product can be marked sold');
}

function householdApproved(ctx: ProductContext): DomainError<ProductGuardCode> | undefined {
  return ctx.householdStatus === 'APPROVED'
    ? undefined
    : new DomainError('HOUSEHOLD_NOT_APPROVED', 'household must be approved to publish', {
        householdStatus: ctx.householdStatus,
      });
}

function reasonRequired(ctx: ProductContext): DomainError<ProductGuardCode> | undefined {
  return ctx.reason !== undefined && ctx.reason.trim().length > 0
    ? undefined
    : new DomainError('REASON_REQUIRED', 'a reason is required');
}

export const PRODUCT_TRANSITIONS = {
  DRAFT: {
    PUBLISH: { to: 'PUBLISHED', guards: [ownerOnly, householdApproved] },
  },
  PUBLISHED: {
    WITHDRAW: { to: 'WITHDRAWN', guards: [ownerOrAdmin], inputGuards: [reasonRequired] },
    MARK_SOLD: { to: 'SOLD', guards: [ownerOnly, oneOfAKind] },
  },
  SOLD: {
    BACK_ON_SALE: { to: 'PUBLISHED', guards: [ownerOnly, householdApproved] },
    WITHDRAW: { to: 'WITHDRAWN', guards: [ownerOrAdmin], inputGuards: [reasonRequired] },
  },
  WITHDRAWN: {
    REPUBLISH: { to: 'PUBLISHED', guards: [ownerOnly, householdApproved] },
  },
} as const satisfies TransitionTable<ProductStatus, ProductEvent, ProductContext, ProductGuardCode>;

const productMachine = createStateMachine<
  ProductStatus,
  ProductEvent,
  ProductContext,
  ProductGuardCode
>({
  name: 'Product',
  states: PRODUCT_STATUSES,
  events: PRODUCT_EVENTS,
  table: PRODUCT_TRANSITIONS,
});

export const productTransition = productMachine.transition;
export const availableProductEvents = productMachine.availableEvents;
export const productStructuralNext = productMachine.structuralNext;

/**
 * Kết quả tra một sản phẩm từ trang công khai / mã QR:
 * - `VISIBLE`: hiện đầy đủ (`PUBLISHED`, and `SOLD`, which stays visible with a sold badge).
 * - `UNAVAILABLE`: sản phẩm từng công khai nhưng đã rút, hoặc hộ bị tạm ngừng ⇒ chỉ hiện thông báo,
 *   không lộ nội dung riêng.
 * - `MISSING`: chưa từng công khai (bản nháp) hoặc hộ chưa/không được duyệt ⇒ trang "không tìm thấy".
 */
export type PublicAvailability = 'VISIBLE' | 'UNAVAILABLE' | 'MISSING';

export function publicProductAvailability(
  householdStatus: HouseholdStatus,
  productStatus: ProductStatus,
): PublicAvailability {
  if (productStatus === 'DRAFT') return 'MISSING';
  // Hộ chưa duyệt / bị từ chối thì chưa từng có gì công khai, kể cả sản phẩm đã rút
  if (householdStatus === 'PENDING_REVIEW' || householdStatus === 'REJECTED') return 'MISSING';
  if (householdStatus === 'SUSPENDED' || productStatus === 'WITHDRAWN') return 'UNAVAILABLE';
  return 'VISIBLE';
}
