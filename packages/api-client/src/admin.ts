import {
  AdminDashboardSchema,
  AdminHouseholdListSchema,
  AdminNewsListSchema,
  AdminNewsSchema,
  type AdminUserListQuery,
  AdminUserListSchema,
  AdminUserSchema,
  AllocationScheduleSchema,
  AssistantStatsSchema,
  AuditActorListSchema,
  AuditLogPageSchema,
  type AuditLogQuery,
  CoordinationQueueSchema,
  HouseholdDocumentListSchema,
  type HouseholdDto,
  HouseholdResponseSchema,
  InvitationListSchema,
  InvitationSchema,
  type InviteAccountRequest,
  type ListAdminNewsQuery,
  MediaAssetResponseSchema,
  MediaReadUrlResponseSchema,
  type ReallocateRequest,
  RevealedIdNumberResponseSchema,
  RfqResponseSchema,
  type SaveNewsRequest,
} from '@vcraft/contracts';
import { type AuthedClientOptions, createAuthedRequest } from './http/authed-request';

export type HouseholdAction = 'approve' | 'reject' | 'request-info' | 'suspend' | 'reinstate';

export interface AdminHouseholdFilters {
  status?: HouseholdDto['status'] | undefined;
  /** Ngày nộp hồ sơ, `YYYY-MM-DD`. */
  from?: string | undefined;
  to?: string | undefined;
}

/** Màn Ban quản lý: số liệu, hàng đợi duyệt hộ, giấy tờ riêng tư qua URL ký 5 phút. */
export function createAdminClient(options: AuthedClientOptions) {
  const request = createAuthedRequest(options);
  return {
    dashboard: () => request('/admin/dashboard', AdminDashboardSchema),
    /** The Fox assistant's card on the dashboard (GH#82). */
    assistantStats: (days = 7) =>
      request(`/admin/assistant/stats?days=${days}`, AssistantStatsSchema),
    listHouseholds: (filters: AdminHouseholdFilters = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/households${suffix}`, AdminHouseholdListSchema);
    },
    getHousehold: (id: string) => request(`/admin/households/${id}`, HouseholdResponseSchema),
    /** The full citizen ID number. Each call is written to the audit log (NFR-SEC-03). */
    revealIdNumber: (id: string) =>
      request(`/admin/households/${id}/id-number`, RevealedIdNumberResponseSchema),
    coordinationQueue: () => request('/admin/coordination', CoordinationQueueSchema),
    /** Running orders with each household's share on a timeline (PLAN E10). */
    allocationSchedule: () => request('/admin/allocations', AllocationScheduleSchema),
    reallocate: (id: string, version: number, body: ReallocateRequest) =>
      request(`/admin/allocations/${id}/reallocate`, AllocationScheduleSchema, {
        method: 'POST',
        version,
        body,
      }),
    claimCoordination: (id: string, version: number) =>
      request(`/rfqs/${id}/coordinate`, RfqResponseSchema, { method: 'POST', version }),
    auditLog: (filters: Partial<AuditLogQuery> = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters))
        if (value !== undefined && value !== '') query.set(key, String(value));
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/audit-log${suffix}`, AuditLogPageSchema);
    },
    auditActors: () => request('/admin/audit-log/actors', AuditActorListSchema),
    listNews: (filters: Partial<ListAdminNewsQuery> = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters))
        if (value !== undefined && value !== '') query.set(key, String(value));
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/news${suffix}`, AdminNewsListSchema);
    },
    getNews: (id: string) => request(`/admin/news/${id}`, AdminNewsSchema),
    createNews: (body: SaveNewsRequest) =>
      request('/admin/news', AdminNewsSchema, { method: 'POST', body }),
    updateNews: (id: string, version: number, body: SaveNewsRequest) =>
      request(`/admin/news/${id}`, AdminNewsSchema, { method: 'PUT', body, version }),
    deleteNews: (id: string, version: number) =>
      request(`/admin/news/${id}`, { parse: () => undefined }, { method: 'DELETE', version }),
    getMedia: (id: string) => request(`/media/${id}`, MediaAssetResponseSchema),
    documents: (id: string) =>
      request(`/admin/households/${id}/documents`, HouseholdDocumentListSchema),
    documentUrl: (mediaId: string) =>
      request(`/media/${mediaId}/read-url`, MediaReadUrlResponseSchema),
    /** Accounts for the suspension screen (FR-AUTH-10). */
    listUsers: (filters: Partial<AdminUserListQuery> = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters))
        if (value !== undefined && value !== '') query.set(key, String(value));
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/users${suffix}`, AdminUserListSchema);
    },
    /** Suspends the account and bans it on Supabase; the reason is kept in the audit log. */
    suspendUser: (id: string, reason: string) =>
      request(`/admin/users/${id}/suspend`, AdminUserSchema, { method: 'POST', body: { reason } }),
    unsuspendUser: (id: string, reason?: string) =>
      request(`/admin/users/${id}/unsuspend`, AdminUserSchema, {
        method: 'POST',
        body: reason ? { reason } : {},
      }),
    /** Invitations sent by the board (FR-AUTH-03). */
    listInvitations: () => request('/admin/invitations', InvitationListSchema),
    inviteAccount: (body: InviteAccountRequest) =>
      request('/admin/invitations', InvitationSchema, { method: 'POST', body }),
    decide: (id: string, action: HouseholdAction, version: number, reason?: string) =>
      request(`/admin/households/${id}/${action}`, HouseholdResponseSchema, {
        method: 'POST',
        version,
        body: reason ? { reason } : {},
      }),
  };
}
export type AdminClient = ReturnType<typeof createAdminClient>;
