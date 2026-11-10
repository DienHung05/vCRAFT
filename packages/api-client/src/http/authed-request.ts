import {
  type ErrorCode,
  type FieldError,
  formatVersionTag,
  ProblemDetailsSchema,
} from '@vcraft/contracts';
import { fallbackErrorCode } from './fallback-error-code';

export class ApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly fieldErrors: readonly FieldError[] = [],
  ) {
    super(code);
    this.name = 'ApiError';
  }
}

export interface AuthedClientOptions {
  /** Cancels requests made by this client, for example when its owner unmounts. */
  signal?: AbortSignal;
  getAccessToken: () => Promise<string | null>;
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

export interface RequestOptions {
  signal?: AbortSignal;
  method?: string;
  body?: unknown;
  /** Multipart uploads keep the browser-generated Content-Type boundary. */
  form?: FormData;
  /** Khóa lạc quan: gửi `If-Match` với phiên bản đang xem. */
  version?: number;
  /** Sent as `Idempotency-Key` (BR-L5) so the API runs a retried state change once. */
  idempotencyKey?: string;
}

/**
 * Per-call options of the state-changing calls that send an `Idempotency-Key`: a fresh UUID is generated
 * when the call starts, or `idempotencyKey` when the caller already holds one for this user action.
 */
export interface ActionOptions {
  idempotencyKey?: string;
}

export const newIdempotencyKey = () => globalThis.crypto.randomUUID();

/** Authenticated JSON or multipart requests with RFC 9457 errors and validated responses. */
export function createAuthedRequest(
  options: AuthedClientOptions,
  ErrorType: typeof ApiError = ApiError,
) {
  const fetcher = options.fetch ?? globalThis.fetch;
  return async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    {
      method = 'GET',
      body,
      form,
      version,
      idempotencyKey,
      signal = options.signal,
    }: RequestOptions = {},
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new ErrorType('AUTH_UNAUTHENTICATED', 401);
    const response = await fetcher(`/api/v1${path}`, {
      method,
      cache: 'no-store',
      ...(signal ? { signal } : {}),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(body !== undefined && !form ? { 'Content-Type': 'application/json' } : {}),
        ...(version !== undefined ? { 'If-Match': formatVersionTag(version) } : {}),
        ...(idempotencyKey !== undefined ? { 'Idempotency-Key': idempotencyKey } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      ...(form ? { body: form } : {}),
    });
    const parse = (data: unknown): T => {
      try {
        return schema.parse(data);
      } catch {
        throw new ErrorType('INTERNAL_ERROR', response.status);
      }
    };
    if (response.status === 204) return parse(undefined);
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      signal?.throwIfAborted();
      throw new ErrorType(fallbackErrorCode(response.status), response.status);
    }
    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(data);
      throw new ErrorType(
        problem.success ? problem.data.code : fallbackErrorCode(response.status),
        response.status,
        problem.success ? problem.data.errors : [],
      );
    }
    return parse(data);
  };
}
