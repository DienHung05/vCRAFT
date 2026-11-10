import {
  type ApplyHouseholdRequest,
  ApplyHouseholdRequestSchema,
  ConsentListResponseSchema,
  type ConsentPurposeDto,
  ConsentResponseSchema,
  type CreateWorkshopRequest,
  CreateWorkshopRequestSchema,
  DataExportSchema,
  FavouritesResponseSchema,
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
  ResubmitHouseholdResponseSchema,
  SlugAvailabilityResponseSchema,
  UnreadCountResponseSchema,
  type UpdateNotificationPreferencesRequest,
  UpdateNotificationPreferencesRequestSchema,
  WorkshopResponseSchema,
} from '@vcraft/contracts';
import { ApiError, type AuthedClientOptions, createAuthedRequest } from './http/authed-request';

/** Keeps existing account-specific catch handlers compatible with the shared API error. */
export class AccountApiError extends ApiError {
  override name = 'AccountApiError';
}

export type AccountClientOptions = AuthedClientOptions;
const noContent = { parse: (): void => undefined };

/**
 * Client cho phiên và hồ sơ hộ (FR-AUTH-02, FR-AUTH-09): `/me`, `/me/household`, tải giấy tờ lên
 * bucket riêng tư, cùng thông báo và tùy chọn email của chính người dùng (GH#37). Token luôn lấy từ phiên Supabase hiện tại; không có token thì không gửi gì.
 */
export function createAccountClient(options: AccountClientOptions) {
  const request = createAuthedRequest(options, AccountApiError);

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
        body: ApplyHouseholdRequestSchema.parse(input),
      });
    },
    addWorkshop(input: CreateWorkshopRequest) {
      return request('/me/household/workshops', WorkshopResponseSchema, {
        method: 'POST',
        body: CreateWorkshopRequestSchema.parse(input),
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
        body: { purpose, policyVersion },
      });
    },
    /** Withdraw the consent for `purpose`; answers with the refreshed list (Decree 13/2023/ND-CP Art. 12). */
    withdrawConsent(purpose: ConsentPurposeDto) {
      return request(`/me/consents/${purpose}`, ConsentListResponseSchema, { method: 'DELETE' });
    },
    /** Everything the platform holds about the person, as one JSON document (NFR-SEC-07). */
    exportMyData() {
      return request('/me/data-export', DataExportSchema);
    },
    /** Delete the account. `confirmation` is the account's own email, typed by the person. */
    deleteAccount(confirmation: string) {
      return request('/me', noContent, { method: 'DELETE', body: { confirmation } });
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
      return request(`/me/favourites/${IdSchema.parse(productId)}`, noContent, { method: 'PUT' });
    },
    /** Idempotent: removing a product that is not saved succeeds. */
    removeFavourite(productId: string) {
      return request(`/me/favourites/${IdSchema.parse(productId)}`, noContent, {
        method: 'DELETE',
      });
    },
    saveNotificationPreferences(input: UpdateNotificationPreferencesRequest) {
      return request('/me/notification-preferences', NotificationPreferencesResponseSchema, {
        method: 'PUT',
        body: UpdateNotificationPreferencesRequestSchema.parse(input),
      });
    },
  };
}

export type AccountClient = ReturnType<typeof createAccountClient>;
