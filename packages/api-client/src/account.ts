import {
  type ApplyHouseholdRequest,
  ApplyHouseholdRequestSchema,
  ConsentListResponseSchema,
  type ConsentPurposeDto,
  ConsentResponseSchema,
  type CreateWorkshopRequest,
  CreateWorkshopRequestSchema,
  DataExportSchema,
  type ErrorCode,
  FavouritesResponseSchema,
  type FieldError,
  formatVersionTag,
  HouseholdDocumentListSchema,
  HouseholdResponseSchema,
  IdSchema,
  LoginEventListSchema,
  MarkAllNotificationsReadResponseSchema,
  MediaAssetResponseSchema,
  MeResponseSchema,
  NotificationListResponseSchema,
  NotificationPreferencesResponseSchema,
  NotificationResponseSchema,
  ProblemDetailsSchema,
  ResubmitHouseholdResponseSchema,
  SlugAvailabilityResponseSchema,
  UnreadCountResponseSchema,
  type UpdateNotificationPreferencesRequest,
  UpdateNotificationPreferencesRequestSchema,
  WorkshopResponseSchema,
} from '@vcraft/contracts';
import { fallbackErrorCode } from './http/fallback-error-code';

/** Lỗi API của nhóm tài khoản: mã ổn định để giao diện tra i18n, kèm lỗi theo field (nếu có). */
export class AccountApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly fieldErrors: readonly FieldError[] = [],
  ) {
    super(code);
    this.name = 'AccountApiError';
  }
}

export interface AccountClientOptions {
  getAccessToken: () => Promise<string | null>;
  /** Mặc định `globalThis.fetch`. Server truyền bản ghép sẵn gốc `API_INTERNAL_URL`. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Client cho phiên và hồ sơ hộ (FR-AUTH-02, FR-AUTH-09): `/me`, `/me/household`, tải giấy tờ lên
 * bucket riêng tư, cùng thông báo và tùy chọn email của chính người dùng (GH#37). Token luôn lấy từ phiên Supabase hiện tại; không có token thì không gửi gì.
 */
export function createAccountClient(options: AccountClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    init: { method?: string; json?: unknown; form?: FormData; version?: number } = {},
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new AccountApiError('AUTH_UNAUTHENTICATED', 401);
    const response = await fetcher(`/api/v1${path}`, {
      method: init.method ?? 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        // Multipart tự đặt Content-Type kèm boundary, nên chỉ JSON mới khai báo.
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
        // Optimistic concurrency: endpoints that require `If-Match` (vCRAFT-8my.2 resubmit).
        ...(init.version !== undefined ? { 'If-Match': formatVersionTag(init.version) } : {}),
      },
      ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}),
      ...(init.form ? { body: init.form } : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AccountApiError(fallbackErrorCode(response.status), response.status);
    }
    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(data);
      throw problem.success
        ? new AccountApiError(problem.data.code, response.status, problem.data.errors)
        : new AccountApiError(fallbackErrorCode(response.status), response.status);
    }
    return schema.parse(data);
  }

  /** For calls whose success answer has no JSON body (204). Errors are read like in {@link request}. */
  async function requestVoid(
    path: string,
    init: { method: string; json?: unknown },
  ): Promise<void> {
    const token = await options.getAccessToken();
    if (!token) throw new AccountApiError('AUTH_UNAUTHENTICATED', 401);
    const response = await fetcher(`/api/v1${path}`, {
      method: init.method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}),
    });
    if (response.ok) return;
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AccountApiError(fallbackErrorCode(response.status), response.status);
    }
    const problem = ProblemDetailsSchema.safeParse(data);
    throw problem.success
      ? new AccountApiError(problem.data.code, response.status, problem.data.errors)
      : new AccountApiError(fallbackErrorCode(response.status), response.status);
  }

  return {
    /** Người đang đăng nhập, theo CSDL vCraft: nguồn cho guard vai trò. */
    me() {
      return request('/me', MeResponseSchema);
    },
    /** Recent sign-ins of this account, newest first (GH#83). */
    loginEvents() {
      return request('/me/login-events', LoginEventListSchema);
    },
    /** Signs every other device out; the session making the call stays. Returns the refreshed history. */
    signOutOtherSessions() {
      return request('/me/sessions/sign-out-others', LoginEventListSchema, { method: 'POST' });
    },
    getMyHousehold() {
      return request('/me/household', HouseholdResponseSchema);
    },
    /** FR-ART-01: is this page address free? Used while the sign-up wizard's address is typed. */
    slugAvailability(slug: string) {
      return request(
        `/households/slug-availability?slug=${encodeURIComponent(slug)}`,
        SlugAvailabilityResponseSchema,
      );
    },
    /** Start the application as a draft (`DRAFT`); the account becomes a household representative. */
    applyHousehold(input: ApplyHouseholdRequest) {
      return request('/me/household', HouseholdResponseSchema, {
        method: 'POST',
        json: ApplyHouseholdRequestSchema.parse(input),
      });
    },
    addWorkshop(input: CreateWorkshopRequest) {
      return request('/me/household/workshops', WorkshopResponseSchema, {
        method: 'POST',
        json: CreateWorkshopRequestSchema.parse(input),
      });
    },
    /** Final wizard step: send the draft application to the board (`PENDING_REVIEW`). */
    submitHousehold() {
      return request('/me/household/submit', HouseholdResponseSchema, { method: 'POST' });
    },
    /** The household's own uploaded documents, so the wizard shows them again after a reload. */
    getMyDocuments() {
      return request('/me/household/documents', HouseholdDocumentListSchema);
    },
    /** Explicit resubmission after edits (vCRAFT-8my.2); `If-Match` guards a stale write. */
    resubmitHousehold(version: number) {
      return request('/me/household/resubmit', ResubmitHouseholdResponseSchema, {
        method: 'POST',
        version,
      });
    },
    /** Giấy tờ xác minh: đi vào bucket riêng tư, chỉ Ban quản lý xem được. */
    uploadCertificate(
      file: Blob,
      filename: string,
      kind?: 'IDENTITY' | 'RESIDENCE' | 'WORKSHOP' | 'UNKNOWN',
    ) {
      const form = new FormData();
      form.append('file', file, filename);
      const suffix = kind ? `&kind=${kind}` : '';
      return request(`/media?purpose=CERTIFICATE${suffix}`, MediaAssetResponseSchema, {
        method: 'POST',
        form,
      });
    },
    /** Consents on record and the policy version currently asked for (NFR-SEC-07). */
    listConsents() {
      return request('/me/consents', ConsentListResponseSchema);
    },
    /** Record that the person ticked the consent box for `purpose` under the current policy. */
    recordConsent(purpose: ConsentPurposeDto, policyVersion: string) {
      return request('/me/consents', ConsentResponseSchema, {
        method: 'POST',
        json: { purpose, policyVersion },
      });
    },
    /** Everything the platform holds about the person, as one JSON document (NFR-SEC-07). */
    exportMyData() {
      return request('/me/data-export', DataExportSchema);
    },
    /** Delete the account. `confirmation` is the account's own email, typed by the person. */
    deleteAccount(confirmation: string) {
      return requestVoid('/me', { method: 'DELETE', json: { confirmation } });
    },
    /** Chuông thông báo: `limit` thông báo mới nhất kèm tổng số chưa đọc. */
    listNotifications(limit = 30) {
      return request(`/me/notifications?limit=${limit}`, NotificationListResponseSchema);
    },
    /** Nhẹ hơn danh sách: dùng cho nhịp hỏi lại khi dropdown đang đóng. */
    unreadNotificationCount() {
      return request('/me/notifications/unread-count', UnreadCountResponseSchema);
    },
    markNotificationRead(id: string) {
      return request(`/me/notifications/${IdSchema.parse(id)}/read`, NotificationResponseSchema, {
        method: 'POST',
      });
    },
    markAllNotificationsRead() {
      return request('/me/notifications/read-all', MarkAllNotificationsReadResponseSchema, {
        method: 'POST',
      });
    },
    /** Tùy chọn email của các loại thông báo vai trò hiện tại có thể nhận. */
    notificationPreferences() {
      return request('/me/notification-preferences', NotificationPreferencesResponseSchema);
    },
    /** The saved products that are still publicly visible, most recently saved first (FR-CAT-07). */
    favourites() {
      return request('/me/favourites', FavouritesResponseSchema);
    },
    /** Idempotent: saving a product that is already saved succeeds. */
    addFavourite(productId: string) {
      return requestVoid(`/me/favourites/${IdSchema.parse(productId)}`, { method: 'PUT' });
    },
    /** Idempotent: removing a product that is not saved succeeds. */
    removeFavourite(productId: string) {
      return requestVoid(`/me/favourites/${IdSchema.parse(productId)}`, { method: 'DELETE' });
    },
    saveNotificationPreferences(input: UpdateNotificationPreferencesRequest) {
      return request('/me/notification-preferences', NotificationPreferencesResponseSchema, {
        method: 'PUT',
        json: UpdateNotificationPreferencesRequestSchema.parse(input),
      });
    },
  };
}

export type AccountClient = ReturnType<typeof createAccountClient>;
