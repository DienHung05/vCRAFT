import { type ErrorCode, formatVersionTag, ProblemDetailsSchema } from '@vcraft/contracts';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface AuthedClientOptions {
  getAccessToken: () => Promise<string | null>;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /** Khóa lạc quan: gửi `If-Match` với phiên bản đang xem. */
  version?: number;
}

/** Gọi API riêng tư kèm token của phiên hiện tại; lỗi luôn thành `ApiError` theo RFC 9457. */
export function createAuthedRequest(options: AuthedClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;
  return async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    { method = 'GET', body, version }: RequestOptions = {},
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new ApiError('AUTH_UNAUTHENTICATED', 401);
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
    if (response.status === 204) return schema.parse(undefined);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new ApiError('INTERNAL_ERROR', response.status);
    }
    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(data);
      throw new ApiError(problem.success ? problem.data.code : 'INTERNAL_ERROR', response.status);
    }
    return schema.parse(data);
  };
}
