import {
  type ApplyHouseholdRequest,
  ApplyHouseholdRequestSchema,
  type CreateWorkshopRequest,
  CreateWorkshopRequestSchema,
  type ErrorCode,
  type FieldError,
  HouseholdResponseSchema,
  MediaAssetResponseSchema,
  MeResponseSchema,
  ProblemDetailsSchema,
  WorkshopResponseSchema,
} from '@vcraft/contracts';

/** Lỗi API của nhóm tài khoản: mã ổn định để giao diện tra i18n, kèm lỗi theo field (nếu có). */
export class AccountApiError extends Error {
  constructor(
    readonly code: ErrorCode,
    readonly status: number,
    readonly fieldErrors: readonly FieldError[] = [],
  ) {
    super(code);
    this.name = 'AccountApiError';
  }
}

export interface AccountClientOptions {
  getAccessToken: () => Promise<string | null>;
  /** Mặc định `globalThis.fetch`. Server truyền bản ghép sẵn gốc `API_INTERNAL_URL`. */
  fetch?: (url: string, init: RequestInit) => Promise<Response>;
}

/**
 * Client cho phiên và hồ sơ hộ (FR-AUTH-02, FR-AUTH-09): `/me`, `/me/household`, tải giấy tờ lên
 * bucket riêng tư. Token luôn lấy từ phiên Supabase hiện tại; không có token thì không gửi gì.
 */
export function createAccountClient(options: AccountClientOptions) {
  const fetcher = options.fetch ?? globalThis.fetch;

  async function request<T>(
    path: string,
    schema: { parse: (data: unknown) => T },
    init: { method?: string; json?: unknown; form?: FormData } = {},
  ): Promise<T> {
    const token = await options.getAccessToken();
    if (!token) throw new AccountApiError('AUTH_UNAUTHENTICATED', 401);
    const response = await fetcher(`/api/v1${path}`, {
      method: init.method ?? 'GET',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        // Multipart tự đặt Content-Type kèm boundary, nên chỉ JSON mới khai báo.
        ...(init.json !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(init.json !== undefined ? { body: JSON.stringify(init.json) } : {}),
      ...(init.form ? { body: init.form } : {}),
    });
    let data: unknown;
    try {
      data = await response.json();
    } catch {
      throw new AccountApiError('INTERNAL_ERROR', response.status);
    }
    if (!response.ok) {
      const problem = ProblemDetailsSchema.safeParse(data);
      throw problem.success
        ? new AccountApiError(problem.data.code, response.status, problem.data.errors)
        : new AccountApiError('INTERNAL_ERROR', response.status);
    }
    return schema.parse(data);
  }

  return {
    /** Người đang đăng nhập, theo CSDL vCraft: nguồn cho guard vai trò. */
    me() {
      return request('/me', MeResponseSchema);
    },
    getMyHousehold() {
      return request('/me/household', HouseholdResponseSchema);
    },
    /** Nộp hồ sơ hộ (`PENDING_REVIEW`); tài khoản trở thành người đại diện hộ. */
    applyHousehold(input: ApplyHouseholdRequest) {
      return request('/me/household', HouseholdResponseSchema, {
        method: 'POST',
        json: ApplyHouseholdRequestSchema.parse(input),
      });
    },
    addWorkshop(input: CreateWorkshopRequest) {
      return request('/me/household/workshops', WorkshopResponseSchema, {
        method: 'POST',
        json: CreateWorkshopRequestSchema.parse(input),
      });
    },
    /** Giấy tờ xác minh: đi vào bucket riêng tư, chỉ Ban quản lý xem được. */
    uploadCertificate(file: Blob, filename: string) {
      const form = new FormData();
      form.append('file', file, filename);
      return request('/media?purpose=CERTIFICATE', MediaAssetResponseSchema, {
        method: 'POST',
        form,
      });
    },
  };
}

export type AccountClient = ReturnType<typeof createAccountClient>;
