/**
 * Danh mục mã lỗi ổn định của API (ARCHITECTURE §4.2, SRS §4.1 và §4.4).
 *
 * - `code` là hợp đồng giữa BE và FE: FE tra i18n theo `code`, không phụ thuộc `title`/`detail`.
 * - Đã phát hành thì không đổi tên, không tái sử dụng cho nghĩa khác; thêm mã mới ở cuối nhóm.
 * - `title` là chuỗi tiếng Anh ngắn cho nhà phát triển / log (RFC 9457 §3.1.4). Thông điệp hiển thị
 *   cho người dùng nằm ở `packages/i18n`.
 * - `status` là HTTP status mặc định; endpoint có thể ghi đè khi thật sự cần.
 */
export const ERROR_CATALOG = {
  // --- AUTH: xác thực & phân quyền (FR-AUTH, NFR-SEC-02/04) ---
  AUTH_INVALID_CREDENTIALS: { status: 401, title: 'Invalid login credentials' },
  USERNAME_TAKEN: { status: 409, title: 'Username already taken' },
  USERNAME_RESERVED: { status: 422, title: 'Username reserved for system accounts' },
  CAPTCHA_FAILED: { status: 400, title: 'Captcha verification failed' },
  AUTH_UNAUTHENTICATED: { status: 401, title: 'Authentication required' },
  AUTH_TOKEN_INVALID: { status: 401, title: 'Invalid access token' },
  AUTH_TOKEN_EXPIRED: { status: 401, title: 'Access token expired' },
  AUTH_FORBIDDEN: { status: 403, title: 'Permission denied' },
  AUTH_EMAIL_NOT_VERIFIED: { status: 403, title: 'Email not verified' },
  /** FR-AUTH-10: tài khoản bị tạm khóa, chặn ngay ở request kế tiếp. */
  AUTH_ACCOUNT_SUSPENDED: { status: 403, title: 'Account suspended' },
  /** NFR-SEC: Admin cần phiên `aal2` (đã qua MFA). */
  AUTH_MFA_REQUIRED: { status: 403, title: 'Multi-factor authentication required' },

  // --- VALIDATION: dữ liệu vào ---
  /** Zod không qua; `errors[]` liệt kê lỗi theo field. */
  VALIDATION_FAILED: { status: 422, title: 'Validation failed' },
  /** Body không phải JSON hợp lệ, thiếu body, sai Content-Type. */
  VALIDATION_MALFORMED_REQUEST: { status: 400, title: 'Malformed request' },

  // --- NOT_FOUND ---
  NOT_FOUND: { status: 404, title: 'Resource not found' },

  // --- CONFLICT: xung đột trạng thái / khóa (SRS §4.4) ---
  /** BR-L1: `If-Match` / `version` cũ (khóa lạc quan). */
  STALE_VERSION: { status: 409, title: 'Stale version' },
  /** BR-L1: thiếu `If-Match` ở endpoint cập nhật. */
  VERSION_REQUIRED: { status: 428, title: 'Version precondition required' },
  /** SRS §4.1: sự kiện không có trong bảng chuyển trạng thái (RFQ/Bid/Allocation). */
  INVALID_TRANSITION: { status: 409, title: 'Invalid state transition' },
  /** Vi phạm ràng buộc UNIQUE không thuộc mã nghiệp vụ riêng (email, slug...). */
  CONFLICT_DUPLICATE: { status: 409, title: 'Duplicate resource' },
  /** Luật nghiệp vụ của domain bị vi phạm mà không có mã riêng; `detail` mang mã domain. */
  BUSINESS_RULE_VIOLATED: { status: 409, title: 'Business rule violated' },

  // --- HOUSEHOLD: duyệt hộ & xuất bản (vCRAFT-9hg.3) ---
  /** Hộ chưa được Ban quản lý chấp nhận hoặc đang tạm ngừng nên không xuất bản / nhận báo giá được. */
  HOUSEHOLD_NOT_APPROVED: { status: 409, title: 'Household is not approved' },
  /** The application misses a required part (profile, workshop or document); `errors[].path` names each. */
  APPLICATION_INCOMPLETE: { status: 422, title: 'Application is incomplete' },
  /** Tài khoản đại diện bị khóa: nhật ký bị đóng băng, trang đã xuất bản vẫn còn. */
  HOUSEHOLD_ACCOUNT_LOCKED: { status: 403, title: 'Representative account is locked' },
  /** Ghi công người làm: phải có ít nhất một người, thuộc hộ, mỗi người một lần. */
  MAKER_REQUIRED: { status: 422, title: 'At least one maker is required' },
  MAKER_NOT_IN_HOUSEHOLD: { status: 422, title: 'Maker does not belong to the household' },
  MAKER_DUPLICATED: { status: 422, title: 'Maker credited more than once' },

  // --- JOURNAL: nhật ký sản xuất (vCRAFT-9hg.4) ---
  /** Bỏ qua công đoạn chưa ghi mà thiếu một dòng lý do. */
  JOURNAL_SKIP_REASON_REQUIRED: { status: 422, title: 'Skipping a stage requires a reason' },
  /** Mốc bị đính chính không thuộc nhật ký này. */
  JOURNAL_CORRECTION_TARGET_NOT_FOUND: { status: 422, title: 'Superseded entry not found' },
  /** Mốc đã có bản đính chính; hãy đính chính bản mới nhất. */
  JOURNAL_CORRECTION_TARGET_SUPERSEDED: { status: 409, title: 'Entry already corrected' },
  /** Chưa xuất bản thì sửa thẳng mốc, không cần mốc đính chính. */
  JOURNAL_CORRECTION_BEFORE_PUBLICATION: {
    status: 409,
    title: 'Correct by editing before publication',
  },
  /** Đã xuất bản: không sửa/xóa mốc, chỉ ghi thêm mốc đính chính. */
  JOURNAL_PUBLISHED_IMMUTABLE: { status: 409, title: 'Published journal entries are immutable' },
  /** Chuỗi băm đang lưu không còn khớp: từ chối ghi thêm để không che dấu thay đổi. */
  JOURNAL_INTEGRITY_BROKEN: { status: 409, title: 'Journal hash chain is broken' },
  /** FR-PRD-03: sản phẩm cần ít nhất một mốc nhật ký sản xuất trước khi xuất bản. */
  PRODUCT_JOURNAL_REQUIRED: {
    status: 409,
    title: 'Add a production-log milestone before publishing',
  },
  /** GH#428: the board withdrew this product, so only the board can republish it. */
  PRODUCT_WITHDRAWN_BY_BOARD: {
    status: 409,
    title: 'The board withdrew this product; only the board can republish it',
  },

  // --- RFQ: yêu cầu báo giá, chào giá, phân bổ (SRS §4) ---
  /** BR-L3: mỗi hộ tối đa một bid cho mỗi RFQ (sửa = tăng revision). */
  RFQ_BID_ALREADY_EXISTS: { status: 409, title: 'Bid already exists for this RFQ' },
  /** BR-L4: quá `biddingClosesAt` hoặc RFQ không còn ở SENT/BIDDING. */
  RFQ_BIDDING_CLOSED: { status: 409, title: 'Bidding is closed' },
  /** BR-02: chỉ hộ APPROVED mới nhận lời mời / chào giá. */
  RFQ_ARTISAN_NOT_ELIGIBLE: { status: 403, title: 'Artisan is not eligible for this RFQ' },
  /** BR-05: nothing was sent because no household of the category can take the request. */
  RFQ_NO_MATCHING_HOUSEHOLD: { status: 422, title: 'No household matches this request' },
  /** The request is coordinated by the village board, so households contribute instead of quoting alone. */
  RFQ_DIRECT_QUOTATION_NOT_ALLOWED: {
    status: 409,
    title: 'Coordinated requests take contributions, not direct quotations',
  },
  /** SRS §4.1 T3: `quantityOffered` phải bằng `quantity` của RFQ. */
  RFQ_QUANTITY_MISMATCH: { status: 422, title: 'Offered quantity does not match' },
  /** BR-L6: Σ allocation.quantity phải bằng order.quantity. */
  RFQ_ALLOCATION_SUM_MISMATCH: { status: 422, title: 'Allocation quantities do not add up' },
  /**
   * BR-L6: a contribution, direct quotation, cooperative share or reallocated share above the capacity
   * the household declared for the request's category (FR-ART-06).
   */
  RFQ_CAPACITY_EXCEEDED: { status: 422, title: 'Artisan capacity exceeded' },
  /** A cooperative share above the maximum quantity the household offered for this request. */
  RFQ_OFFER_QUANTITY_EXCEEDED: { status: 409, title: 'Quantity is above the household offer' },

  // --- PAYMENT: online payment of orders (ADR-0021, GH#205) ---
  /** The method is switched off or not configured in this deployment (VNPay and MoMo are sandbox-only behind a flag). */
  PAYMENT_METHOD_UNAVAILABLE: { status: 409, title: 'Payment method is not available' },
  /** The order is not in a state that takes this payment (deposit before production, balance until delivery). */
  PAYMENT_ORDER_NOT_PAYABLE: { status: 409, title: 'Order cannot take this payment now' },
  /** The deposit or the balance of this order is already paid. */
  PAYMENT_ALREADY_PAID: { status: 409, title: 'Payment is already paid' },
  /** Production (or the balance) waits for a paid deposit. */
  PAYMENT_DEPOSIT_REQUIRED: { status: 409, title: 'The deposit must be paid first' },
  /** The provider webhook did not carry valid credentials or a valid signature. */
  PAYMENT_WEBHOOK_REJECTED: { status: 401, title: 'Payment webhook rejected' },

  // --- IDEMPOTENCY: BR-L5 ---
  IDEMPOTENCY_KEY_REQUIRED: { status: 400, title: 'Idempotency-Key header required' },
  /** Cùng key nhưng payload khác (so `requestHash`). */
  IDEMPOTENCY_KEY_REUSED: { status: 422, title: 'Idempotency-Key reused with a different request' },
  /** Request đầu với key này vẫn đang xử lý. */
  IDEMPOTENCY_IN_PROGRESS: { status: 409, title: 'Original request is still in progress' },

  // --- MEDIA: upload (NFR-SEC-05) ---
  MEDIA_UNSUPPORTED_TYPE: { status: 415, title: 'Unsupported media type' },
  MEDIA_TOO_LARGE: { status: 413, title: 'Media too large' },
  /** An image above 50 megapixels, refused at upload from its header instead of failing in the worker. */
  MEDIA_RESOLUTION_TOO_HIGH: { status: 422, title: 'Image resolution too high' },

  // --- PRIVACY: đồng ý, xuất và xóa dữ liệu cá nhân (NFR-SEC-07) ---
  /** The action collects personal data and no consent for the current policy version is on record. */
  CONSENT_REQUIRED: { status: 403, title: 'Consent required' },
  /** The account represents a household or buyer with orders still in progress. */
  ACCOUNT_DELETION_ACTIVE_ORDERS: { status: 409, title: 'Account has orders in progress' },
  /** Administrator accounts are removed by another administrator, not through self-service. */
  ACCOUNT_DELETION_ADMIN: { status: 409, title: 'Administrator accounts cannot self-delete' },

  // --- HẠ TẦNG ---
  /** NFR-SEC-04: rate limit; kèm header `Retry-After`. */
  RATE_LIMITED: { status: 429, title: 'Too many requests' },
  INTERNAL_ERROR: { status: 500, title: 'Internal server error' },
  SERVICE_UNAVAILABLE: { status: 503, title: 'Service unavailable' },
} as const satisfies Record<string, { status: number; title: string }>;

/** Mã lỗi hợp lệ, dùng như union chuỗi: `'STALE_VERSION' | 'NOT_FOUND' | ...`. */
export type ErrorCode = keyof typeof ERROR_CATALOG;

/** Tra cứu kiểu enum: `ERROR_CODES.STALE_VERSION === 'STALE_VERSION'`. */
export const ERROR_CODES = Object.fromEntries(
  Object.keys(ERROR_CATALOG).map((code) => [code, code]),
) as { readonly [K in ErrorCode]: K };

/** Danh sách mã lỗi (cho `z.enum`). */
export const ERROR_CODE_LIST = Object.keys(ERROR_CATALOG) as [ErrorCode, ...ErrorCode[]];

/** HTTP status mặc định của mã lỗi. */
export function defaultStatusOf(code: ErrorCode): number {
  return ERROR_CATALOG[code].status;
}

/** Tiêu đề (tiếng Anh, cho dev/log) mặc định của mã lỗi. */
export function defaultTitleOf(code: ErrorCode): string {
  return ERROR_CATALOG[code].title;
}

export function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && Object.hasOwn(ERROR_CATALOG, value);
}
