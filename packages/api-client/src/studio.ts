import {
  ArtisanResponseSchema,
  type ConsentPurposeDto,
  ConsentResponseSchema,
  type CreateArtisanRequest,
  type CreateJournalEntryRequest,
  type CreateProductRequest,
  type CreateWorkshopRequest,
  HouseholdResponseSchema,
  JournalResponseSchema,
  MediaAssetResponseSchema,
  ProductResponseSchema,
  type SetProductMakersRequest,
  type UpdateHouseholdProfileRequest,
  type UpdateProductRequest,
  WorkshopResponseSchema,
} from '@vcraft/contracts';
import { type AuthedClientOptions, createAuthedRequest } from './http/authed-request';

/** Studio của hộ: mọi thao tác đi qua API với token của phiên, chủ hộ mới đọc và ghi được. */
export function createStudioClient(options: AuthedClientOptions) {
  const request = createAuthedRequest(options);
  return {
    /** Record consent to the privacy policy for publishing a maker's name (NFR-SEC-07). */
    recordConsent: (purpose: ConsentPurposeDto, policyVersion: string) =>
      request('/me/consents', ConsentResponseSchema, {
        method: 'POST',
        body: { purpose, policyVersion },
      }),
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
    createProduct: (body: CreateProductRequest) =>
      request('/me/household/products', ProductResponseSchema, { method: 'POST', body }),
    updateProduct: (id: string, version: number, body: UpdateProductRequest) =>
      request(`/me/household/products/${id}`, ProductResponseSchema, {
        method: 'PATCH',
        body,
        version,
      }),
    setMakers: (id: string, body: SetProductMakersRequest) =>
      request(`/me/household/products/${id}/makers`, ProductResponseSchema, {
        method: 'PUT',
        body,
      }),
    publishProduct: (id: string, version: number, republish: boolean) =>
      request(`/products/${id}/${republish ? 'republish' : 'publish'}`, ProductResponseSchema, {
        method: 'POST',
        version,
      }),
    withdrawProduct: (id: string, version: number, reason: string) =>
      request(`/products/${id}/withdraw`, ProductResponseSchema, {
        method: 'POST',
        version,
        body: { reason },
      }),
    getJournal: (productId: string) =>
      request(`/me/household/products/${productId}/journal`, JournalResponseSchema),
    appendJournalEntry: (productId: string, body: CreateJournalEntryRequest) =>
      request(`/me/household/products/${productId}/journal`, JournalResponseSchema, {
        method: 'POST',
        body,
      }),
    deleteJournalEntry: (entryId: string, version: number) =>
      request(`/journal-entries/${entryId}`, JournalResponseSchema, { method: 'DELETE', version }),
  };
}
export type StudioClient = ReturnType<typeof createStudioClient>;
