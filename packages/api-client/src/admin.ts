import {
  AdminDashboardSchema,
  AdminHouseholdListSchema,
  AdminNewsListSchema,
  AdminNewsSchema,
  AuditActorListSchema,
  AuditLogPageSchema,
  type AuditLogQuery,
  CoordinationQueueSchema,
  HouseholdDocumentListSchema,
  type HouseholdDto,
  HouseholdResponseSchema,
  type ListAdminNewsQuery,
  MediaAssetResponseSchema,
  MediaReadUrlResponseSchema,
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
    listHouseholds: (filters: AdminHouseholdFilters = {}) => {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters)) if (value) query.set(key, value);
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/admin/households${suffix}`, AdminHouseholdListSchema);
    },
    getHousehold: (id: string) => request(`/admin/households/${id}`, HouseholdResponseSchema),
    coordinationQueue: () => request('/admin/coordination', CoordinationQueueSchema),
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
    decide: (id: string, action: HouseholdAction, version: number, reason?: string) =>
      request(`/admin/households/${id}/${action}`, HouseholdResponseSchema, {
        method: 'POST',
        version,
        body: reason ? { reason } : {},
      }),
  };
}
export type AdminClient = ReturnType<typeof createAdminClient>;
