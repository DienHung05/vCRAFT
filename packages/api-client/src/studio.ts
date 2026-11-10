import {
  ArtisanResponseSchema,
  type ConsentPurposeDto,
  ConsentResponseSchema,
  type CreateArtisanRequest,
  type CreateJournalEntryRequest,
  type CreateProductRequest,
  type CreateQrLabelsRequest,
  type CreateWorkshopRequest,
  HouseholdResponseSchema,
  JournalResponseSchema,
  MediaAssetResponseSchema,
  PriceSuggestionResponseSchema,
  ProductResponseSchema,
  ProductScanStatsSchema,
  QrLabelsResponseSchema,
  type SetIdNumberRequest,
  type SetProductMakersRequest,
  SlugAvailabilityResponseSchema,
  StorySuggestionResponseSchema,
  type UpdateHouseholdProfileRequest,
  type UpdateProductRequest,
  WorkshopResponseSchema,
} from '@vcraft/contracts';
import {
  type ActionOptions,
  type AuthedClientOptions,
  createAuthedRequest,
  newIdempotencyKey,
} from './http/authed-request';

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
    /** Add or replace the representative's citizen ID number (stored encrypted). */
    setIdNumber: (body: SetIdNumberRequest) =>
      request('/me/household/id-number', HouseholdResponseSchema, { method: 'PUT', body }),
    updateProfile: (version: number, body: UpdateHouseholdProfileRequest) =>
      request('/me/household', HouseholdResponseSchema, { method: 'PATCH', body, version }),
    /** FR-ART-01: is this page address free (the household's own address counts as free)? */
    slugAvailability: (slug: string) =>
      request(
        `/households/slug-availability?slug=${encodeURIComponent(slug)}`,
        SlugAvailabilityResponseSchema,
      ),
    /** FR-ART-08: a suggested story (Vietnamese and English); 503 when the model is not configured. */
    storySuggestion: () =>
      request('/me/household/story-suggestion', StorySuggestionResponseSchema, { method: 'POST' }),
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
    createProduct: (body: CreateProductRequest, action: ActionOptions = {}) =>
      request('/me/household/products', ProductResponseSchema, {
        method: 'POST',
        body,
        idempotencyKey: action.idempotencyKey ?? newIdempotencyKey(),
      }),
    updateProduct: (id: string, version: number, body: UpdateProductRequest) =>
      request(`/me/household/products/${id}`, ProductResponseSchema, {
        method: 'PATCH',
        body,
        version,
      }),
    setMakers: (id: string, version: number, body: SetProductMakersRequest) =>
      request(`/me/household/products/${id}/makers`, ProductResponseSchema, {
        method: 'PUT',
        body,
        version,
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
    /** One-of-a-kind products only: PUBLISHED to SOLD. */
    markProductSold: (id: string, version: number) =>
      request(`/products/${id}/mark-sold`, ProductResponseSchema, { method: 'POST', version }),
    /** Undo a sale: SOLD back to PUBLISHED. */
    productBackOnSale: (id: string, version: number) =>
      request(`/products/${id}/back-on-sale`, ProductResponseSchema, { method: 'POST', version }),
    /** FR-PRD-06: a DRAFT copy of the product without its production journal. */
    duplicateProduct: (id: string, action: ActionOptions = {}) =>
      request(`/me/household/products/${id}/duplicate`, ProductResponseSchema, {
        method: 'POST',
        idempotencyKey: action.idempotencyKey ?? newIdempotencyKey(),
      }),
    /** FR-PRD-07: median price of published products in a category (a hint, never auto-applied). */
    getPriceSuggestion: (category: string) =>
      request(
        `/me/household/products/price-suggestion?category=${encodeURIComponent(category)}`,
        PriceSuggestionResponseSchema,
      ),
    /** Queue an A4 QR label sheet (PLAN E6); poll `qrLabelsStatus` until it is READY. */
    requestQrLabels: (body: CreateQrLabelsRequest) =>
      request('/me/household/qr-labels', QrLabelsResponseSchema, { method: 'POST', body }),
    qrLabelsStatus: (requestId: string) =>
      request(`/me/household/qr-labels/${requestId}`, QrLabelsResponseSchema),
    /** FR-TRC-06: scan statistics of one of the household's own products. */
    getScanStats: (productId: string) =>
      request(`/me/household/products/${productId}/scans`, ProductScanStatsSchema),
    getJournal: (productId: string) =>
      request(`/me/household/products/${productId}/journal`, JournalResponseSchema),
    appendJournalEntry: (
      productId: string,
      body: CreateJournalEntryRequest,
      action: ActionOptions = {},
    ) =>
      request(`/me/household/products/${productId}/journal`, JournalResponseSchema, {
        method: 'POST',
        body,
        idempotencyKey: action.idempotencyKey ?? newIdempotencyKey(),
      }),
    deleteJournalEntry: (entryId: string, version: number) =>
      request(`/journal-entries/${entryId}`, JournalResponseSchema, { method: 'DELETE', version }),
  };
}
export type StudioClient = ReturnType<typeof createStudioClient>;
