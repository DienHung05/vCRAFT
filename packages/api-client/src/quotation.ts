import {
  BuyerQuotationResponseSchema,
  ContributionResponseSchema,
  CoordinationResponseSchema,
  type CreateContributionRequest,
  CreateContributionRequestSchema,
  type CreateCooperativeQuotationRequest,
  CreateCooperativeQuotationRequestSchema,
  type ErrorCode,
  formatVersionTag,
  IdSchema,
  InternalQuotationResponseSchema,
  InviteHouseholdsRequestSchema,
  ProblemDetailsSchema,
  QuotationNoticeResponseSchema,
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
    submitQuotation(id: string, version: number, input: CreateCooperativeQuotationRequest) {
      return request(
        `/rfqs/${IdSchema.parse(id)}/quotations`,
        InternalQuotationResponseSchema,
        'POST',
        CreateCooperativeQuotationRequestSchema.parse(input),
        version,
      );
    },
  };
}

export type QuotationClient = ReturnType<typeof createQuotationClient>;
