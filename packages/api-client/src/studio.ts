import {
  ArtisanResponseSchema,
  type CreateArtisanRequest,
  type CreateWorkshopRequest,
  HouseholdResponseSchema,
  MediaAssetResponseSchema,
  type UpdateHouseholdProfileRequest,
  WorkshopResponseSchema,
} from '@vcraft/contracts';
import { type AuthedClientOptions, createAuthedRequest } from './http/authed-request';

/** Studio của hộ: mọi thao tác đi qua API với token của phiên, chủ hộ mới đọc và ghi được. */
export function createStudioClient(options: AuthedClientOptions) {
  const request = createAuthedRequest(options);
  return {
    getHousehold: () => request('/me/household', HouseholdResponseSchema),
    updateProfile: (version: number, body: UpdateHouseholdProfileRequest) =>
      request('/me/household', HouseholdResponseSchema, { method: 'PATCH', body, version }),
    addWorkshop: (body: CreateWorkshopRequest) =>
      request('/me/household/workshops', WorkshopResponseSchema, { method: 'POST', body }),
    updateWorkshop: (id: string, version: number, body: CreateWorkshopRequest) =>
      request(`/me/household/workshops/${id}`, WorkshopResponseSchema, {
        method: 'PUT',
        body,
        version,
      }),
    addArtisan: (body: CreateArtisanRequest) =>
      request('/me/household/artisans', ArtisanResponseSchema, { method: 'POST', body }),
    getMedia: (id: string) => request(`/media/${id}`, MediaAssetResponseSchema),
  };
}
export type StudioClient = ReturnType<typeof createStudioClient>;
