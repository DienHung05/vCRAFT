import {
  type AcceptQuotationRequest,
  AcceptQuotationRequestSchema,
  AllocationResponseSchema,
  BuyerQuotationResponseSchema,
  type CancelOrderRequest,
  CancelOrderRequestSchema,
  type ConsentPurposeDto,
  ConsentResponseSchema,
  ContributionResponseSchema,
  CoordinationResponseSchema,
  type CreateContributionRequest,
  CreateContributionRequestSchema,
  type CreateCooperativeQuotationRequest,
  CreateCooperativeQuotationRequestSchema,
  type CreateDirectQuotationRequest,
  CreateDirectQuotationRequestSchema,
  type CreateRfqRequest,
  CreateRfqRequestSchema,
  DirectQuotationResponseSchema,
  type ErrorCode,
  formatVersionTag,
  HouseholdListResponseSchema,
  IdSchema,
  InternalQuotationResponseSchema,
  InviteHouseholdsRequestSchema,
  type ListRfqsQuery,
  MarkAllNoticesReadResponseSchema,
  MediaAssetResponseSchema,
  MediaReadUrlResponseSchema,
  MyAllocationListSchema,
  MyInvitationListSchema,
  PriceHintResponseSchema,
  ProblemDetailsSchema,
  QuotationNoticeResponseSchema,
  type ReportProgressRequest,
  ReportProgressRequestSchema,
  RfqListResponseSchema,
  RfqResponseSchema,
} from '@vcraft/contracts';

export class QuotationApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'QuotationApiError';
  }
}

export interface QuotationClientOptions {
  getAccessToken: () => Promise<string | null>;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

/** Private business data always travels through the API, with the current session token. */
export function createQuotationClient(options: QuotationClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;
  async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    method = 'GET',
    body?: unknown,
    version?: number,
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new QuotationApiError('AUTH_UNAUTHENTICATED', 401);
    const response = await fetcher(`/api/v1${path}`, {
      method,
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(version !== undefined ? { 'If-Match': formatVersionTag(version) } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new QuotationApiError('INTERNAL_ERROR', response.status);
    }
    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(data);
      throw new QuotationApiError(
        problem.success ? problem.data.code : 'INTERNAL_ERROR',
        response.status,
      );
    }
    return schema.parse(data);
  }

  return {
    /** Record consent to the privacy policy for the delivery address of a request (NFR-SEC-07). */
    recordConsent(purpose: ConsentPurposeDto, policyVersion: string) {
      return request('/me/consents', ConsentResponseSchema, 'POST', { purpose, policyVersion });
    },
    duplicateRequest(id: string) {
      return request(`/rfqs/${IdSchema.parse(id)}/duplicate`, RfqResponseSchema, 'POST');
    },
    coordinate(id: string, version: number) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/coordinate`,
        RfqResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    invite(id: string, version: number, householdIds: string[]) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/invitations`,
        RfqResponseSchema,
        'POST',
        InviteHouseholdsRequestSchema.parse({ householdIds }),
        version,
      );
    },
    listNotices() {
      return request('/me/quotation-notices', QuotationNoticeResponseSchema.array());
    },
    markNoticeRead(id: string) {
      return request(
        `/me/quotation-notices/${IdSchema.parse(id)}/read`,
        QuotationNoticeResponseSchema,
        'POST',
      );
    },
    markAllNoticesRead() {
      return request('/me/quotation-notices/read-all', MarkAllNoticesReadResponseSchema, 'POST');
    },
    listRequests(filters: Partial<ListRfqsQuery> = {}) {
      const query = new URLSearchParams();
      for (const [key, value] of Object.entries(filters))
        if (value !== undefined) query.set(key, String(value));
      const suffix = query.size > 0 ? `?${query}` : '';
      return request(`/rfqs${suffix}`, RfqListResponseSchema);
    },
    createRequest(input: CreateRfqRequest) {
      return request('/rfqs', RfqResponseSchema, 'POST', CreateRfqRequestSchema.parse(input));
    },
    updateRequest(id: string, version: number, input: CreateRfqRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}`,
        RfqResponseSchema,
        'PUT',
        CreateRfqRequestSchema.parse(input),
        version,
      );
    },
    submitRequest(id: string, version: number) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/submit`,
        RfqResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    listInvitations() {
      return request('/me/invitations', MyInvitationListSchema);
    },
    declineInvitation(id: string) {
      return request(`/rfqs/${IdSchema.parse(id)}/decline`, RfqResponseSchema, 'POST');
    },
    listMyAllocations() {
      return request('/me/allocations', MyAllocationListSchema);
    },
    getMedia(id: string) {
      return request(`/media/${IdSchema.parse(id)}`, MediaAssetResponseSchema);
    },
    /** Short-lived signed link to a private file, such as a request attachment. */
    getMediaReadUrl(id: string) {
      return request(`/media/${IdSchema.parse(id)}/read-url`, MediaReadUrlResponseSchema);
    },
    listHouseholds() {
      return request('/households', HouseholdListResponseSchema);
    },
    getRequest(id: string) {
      return request(`/rfqs/${IdSchema.parse(id)}`, RfqResponseSchema);
    },
    getCoordination(id: string) {
      return request(`/rfqs/${IdSchema.parse(id)}/coordination`, CoordinationResponseSchema);
    },
    listBuyerQuotations(id: string) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/quotations`,
        BuyerQuotationResponseSchema.array(),
      );
    },
    /** Suggested unit price range for the signed-in household's offer (PLAN E9). */
    priceHint(id: string) {
      return request(`/rfqs/${IdSchema.parse(id)}/price-hint`, PriceHintResponseSchema);
    },
    listOwnContributions(id: string) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/contributions`,
        ContributionResponseSchema.array(),
      );
    },
    createContribution(id: string, input: CreateContributionRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/contributions`,
        ContributionResponseSchema,
        'POST',
        CreateContributionRequestSchema.parse(input),
      );
    },
    updateContribution(id: string, version: number, input: CreateContributionRequest) {
      return request(
        `/contributions/${IdSchema.parse(id)}`,
        ContributionResponseSchema,
        'PUT',
        CreateContributionRequestSchema.parse(input),
        version,
      );
    },
    withdrawContribution(id: string, version: number) {
      return request(
        `/contributions/${IdSchema.parse(id)}/withdraw`,
        ContributionResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    /** FR-RFQ-04: an invited household quotes the whole request itself (no coordination). */
    createDirectQuotation(id: string, input: CreateDirectQuotationRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/direct-quotations`,
        DirectQuotationResponseSchema,
        'POST',
        CreateDirectQuotationRequestSchema.parse(input),
      );
    },
    /** The household's own direct quotations on a request, newest first. */
    listOwnDirectQuotations(id: string) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/direct-quotations`,
        DirectQuotationResponseSchema.array(),
      );
    },
    reviseDirectQuotation(id: string, version: number, input: CreateDirectQuotationRequest) {
      return request(
        `/direct-quotations/${IdSchema.parse(id)}`,
        DirectQuotationResponseSchema,
        'PUT',
        CreateDirectQuotationRequestSchema.parse(input),
        version,
      );
    },
    withdrawDirectQuotation(id: string, version: number) {
      return request(
        `/direct-quotations/${IdSchema.parse(id)}/withdraw`,
        DirectQuotationResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    submitQuotation(id: string, version: number, input: CreateCooperativeQuotationRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/quotations`,
        InternalQuotationResponseSchema,
        'POST',
        CreateCooperativeQuotationRequestSchema.parse(input),
        version,
      );
    },
    /** GH#11: buyer chốt chào giá đã chọn; version ở If-Match. */
    acceptQuotation(id: string, version: number, input: AcceptQuotationRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/accept`,
        RfqResponseSchema,
        'POST',
        AcceptQuotationRequestSchema.parse(input),
        version,
      );
    },
    /** GH#11: đọc allocations của đơn đã chốt. */
    listAllocations(id: string) {
      return request(`/rfqs/${IdSchema.parse(id)}/allocations`, AllocationResponseSchema.array());
    },
    /** GH#11: admin hoặc hộ đơn-1-hộ bắt đầu sản xuất. */
    startProduction(id: string, version: number) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/start-production`,
        RfqResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    /** GH#11: buyer hoặc admin xác nhận đã nhận hàng. */
    confirmReceipt(id: string, version: number) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/receive`,
        RfqResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    /** GH#11: hộ xác nhận phân bổ của mình. */
    confirmAllocation(id: string, version: number) {
      return request(
        `/allocations/${IdSchema.parse(id)}/confirm`,
        AllocationResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    /** GH#11: hộ từ chối phân bổ ⇒ hủy cả đơn chưa sản xuất. */
    declineAllocation(id: string, version: number) {
      return request(
        `/allocations/${IdSchema.parse(id)}/decline`,
        AllocationResponseSchema,
        'POST',
        undefined,
        version,
      );
    },
    /** GH#11: hộ báo cáo số lượng đã xong trong 0..quantity. */
    reportProgress(id: string, version: number, input: ReportProgressRequest) {
      return request(
        `/allocations/${IdSchema.parse(id)}/progress`,
        AllocationResponseSchema,
        'POST',
        ReportProgressRequestSchema.parse(input),
        version,
      );
    },
    /** GH#11: admin dieu phoi huy don sau san xuat; ly do bat buoc. */
    cancelOrder(id: string, version: number, input: CancelOrderRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/cancel`,
        RfqResponseSchema,
        'POST',
        CancelOrderRequestSchema.parse(input),
        version,
      );
    },
  };
}

export type QuotationClient = ReturnType<typeof createQuotationClient>;
