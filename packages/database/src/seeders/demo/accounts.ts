/**
 * Tài khoản demo cố định (GH#14). File này KHÔNG import gì để script gốc (`scripts/demo/auth.mjs`) và
 * Playwright đọc thẳng bằng Node (type stripping); đừng thêm import hay cú pháp chỉ có ở TypeScript
 * ngoài kiểu (enum, namespace, decorator).
 *
 * `id` = `sub` của Supabase Auth = `app_user.id` (ARCHITECTURE §7.5), nên cùng một UUID phải có mặt ở
 * cả hai nơi: seeder ghi `app_user`, `scripts/demo/auth.mjs` tạo/cập nhật người dùng Supabase Auth với đúng id này.
 * Mật khẩu KHÔNG nằm trong mã: đọc từ biến môi trường tên ở `passwordEnv`.
 *
 * `username` (GH#212): the sign-in handle of the demo account, matching the `app_user.username` the
 * seeder writes and part of the reserved-word set of `@vcraft/domain` (`RESERVED_USERNAMES`).
 */
export interface DemoAccount {
  readonly key: 'admin' | 'buyer' | 'household' | 'pending';
  readonly id: string;
  readonly email: string;
  readonly username: string;
  readonly fullName: string;
  readonly role: 'ADMIN' | 'BUYER' | 'HOUSEHOLD';
  /** Tên biến môi trường giữ mật khẩu. */
  readonly passwordEnv: string;
}

export const DEMO_ACCOUNTS = {
  admin: {
    key: 'admin',
    id: 'd3a10000-0000-4000-8000-000000000001',
    email: 'demo.admin@example.com',
    username: 'admin',
    fullName: 'Ban quản lý làng nghề (mẫu)',
    role: 'ADMIN',
    passwordEnv: 'DEMO_ADMIN_PASSWORD',
  },
  buyer: {
    key: 'buyer',
    id: 'd3a10000-0000-4000-8000-000000000002',
    email: 'demo.buyer@example.com',
    username: 'buyer',
    fullName: 'Công ty Thảo Nguyên (mẫu)',
    role: 'BUYER',
    passwordEnv: 'DEMO_BUYER_PASSWORD',
  },
  household: {
    key: 'household',
    id: 'd3a10000-0000-4000-8000-000000000003',
    email: 'demo.household@example.com',
    username: 'household',
    fullName: 'Lê Đức Phát (mẫu)',
    role: 'HOUSEHOLD',
    passwordEnv: 'DEMO_HOUSEHOLD_PASSWORD',
  },
  pending: {
    key: 'pending',
    id: 'd3a10000-0000-4000-8000-000000000004',
    email: 'demo.pending@example.com',
    username: 'pending',
    fullName: 'Đại diện hộ chờ duyệt (mẫu)',
    role: 'HOUSEHOLD',
    passwordEnv: 'DEMO_PENDING_PASSWORD',
  },
} as const satisfies Record<string, DemoAccount>;

export const DEMO_ACCOUNT_LIST: readonly DemoAccount[] = Object.values(DEMO_ACCOUNTS);

/** Mã truy xuất in trên mã QR của chiếc cốc thật (sản phẩm mẫu cố định, thuộc hộ của tài khoản household). */
export const DEMO_QR_TRACE_CODE = 'DF6P3WZE';

/** Hộ mẫu cố định: hộ của tài khoản household (Lò Đức Phát, đã duyệt) và hộ đang chờ duyệt. */
export const DEMO_HOUSEHOLD_IDS = {
  household: 'd3a10000-0000-4000-8000-000000000202',
  pending: 'd3a10000-0000-4000-8000-000000000201',
} as const;

/**
 * 12 yêu cầu báo giá mẫu, id cố định để kịch bản demo và e2e trỏ thẳng vào đúng yêu cầu.
 * Chú thích: bước demo dùng yêu cầu đó (docs/demo/README.md, ma trận nghiệm thu).
 */
export const DEMO_REQUEST_IDS = {
  /** DRAFT, buyer chưa gửi. */
  draft: 'd3a10000-0000-4000-8000-000000000101',
  /** EXPIRED, quá hạn chào giá mà không ai chốt. */
  expired: 'd3a10000-0000-4000-8000-000000000102',
  /** SENT, không nhờ Ban quản lý điều phối. */
  sentPlain: 'd3a10000-0000-4000-8000-000000000103',
  /** SENT, nhờ điều phối nhưng chưa có admin nhận: bước "admin nhận điều phối". */
  sentOptIn: 'd3a10000-0000-4000-8000-000000000104',
  /** SENT, admin đã nhận, hộ household được mời nhưng chưa đề xuất: bước "hộ đề xuất tham gia". */
  sentCoordinated: 'd3a10000-0000-4000-8000-000000000105',
  /** BIDDING, có chào giá hợp tác SUBMITTED chia 4 hộ: bước "buyer chốt chào giá". */
  biddingToAccept: 'd3a10000-0000-4000-8000-000000000106',
  /** BIDDING, chào giá cũ đã thay thế (WITHDRAWN) + chào giá mới SUBMITTED. */
  biddingReplaced: 'd3a10000-0000-4000-8000-000000000107',
  /** ACCEPTED, 4 hộ: 3 đã CONFIRMED, phần của household còn PROPOSED: bước "hộ xác nhận phân bổ". */
  acceptedConfirm: 'd3a10000-0000-4000-8000-000000000108',
  /** ACCEPTED, 2 hộ còn PROPOSED. */
  acceptedFresh: 'd3a10000-0000-4000-8000-000000000109',
  /** IN_PRODUCTION, đơn chia đúng 4 hộ; 3 hộ DONE, household đang làm: bước "tiến độ" và "nhận hàng". */
  inProduction: 'd3a10000-0000-4000-8000-000000000110',
  /** DELIVERED. */
  delivered: 'd3a10000-0000-4000-8000-000000000111',
  /** CANCELLED. */
  cancelled: 'd3a10000-0000-4000-8000-000000000112',
} as const;
