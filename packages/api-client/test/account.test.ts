import { describe, expect, it } from 'vitest';
import { AccountApiError, createAccountClient } from '../src';

const userId = '123e4567-e89b-12d3-a456-426614174000';

const me = {
  id: userId,
  email: 'buyer@example.com',
  fullName: null,
  role: 'BUYER',
  status: 'ACTIVE',
  emailVerified: true,
  household: null,
};

function client(
  respond: (url: string, init: RequestInit) => Response | Promise<Response>,
  token: string | null = 'session-token',
) {
  const calls: { url: string; init: RequestInit }[] = [];
  return {
    calls,
    api: createAccountClient({
      getAccessToken: async () => token,
      fetch: async (url, init) => {
        calls.push({ url, init });
        return respond(url, init);
      },
    }),
  };
}

describe('account HTTP client', () => {
  it('gửi access token hiện tại và đọc hồ sơ /me theo hợp đồng', async () => {
    const { api, calls } = client(() => Response.json(me));
    await expect(api.me()).resolves.toMatchObject({ role: 'BUYER', household: null });
    expect(calls[0]?.url).toBe('/api/v1/me');
    expect((calls[0]?.init.headers as Record<string, string> | undefined)?.Authorization).toBe(
      'Bearer session-token',
    );
  });

  it('không có phiên thì không gọi API mà ném AUTH_UNAUTHENTICATED', async () => {
    const { api, calls } = client(() => Response.json(me), null);
    await expect(api.me()).rejects.toMatchObject({ code: 'AUTH_UNAUTHENTICATED', status: 401 });
    expect(calls).toHaveLength(0);
  });

  it('chuyển Problem Details thành AccountApiError kèm lỗi theo field', async () => {
    const { api } = client(() =>
      Response.json(
        {
          type: '/problems/validation-failed',
          title: 'Validation failed',
          status: 422,
          code: 'VALIDATION_FAILED',
          errors: [{ path: 'slug', message: 'Đường dẫn không hợp lệ', code: 'invalid_format' }],
        },
        { status: 422 },
      ),
    );
    const error = await api
      .applyHousehold({ name: 'Gốm Bảo Châu', slug: 'gom-bao-chau', history: '' })
      .catch((e: unknown) => e);
    expect(error).toBeInstanceOf(AccountApiError);
    expect(error).toMatchObject({ code: 'VALIDATION_FAILED', status: 422 });
    expect((error as AccountApiError).fieldErrors[0]).toMatchObject({ path: 'slug' });
  });

  it('phản hồi không phải JSON thành INTERNAL_ERROR, không lộ nội dung', async () => {
    const { api } = client(() => new Response('<html>502</html>', { status: 502 }));
    await expect(api.me()).rejects.toMatchObject({ code: 'INTERNAL_ERROR', status: 502 });
  });

  it('nộp hồ sơ hộ bằng JSON qua POST /me/household', async () => {
    const { api, calls } = client(() =>
      Response.json(
        {
          id: userId,
          version: 0,
          name: 'Gốm Bảo Châu',
          slug: 'gom-bao-chau',
          history: '',
          village: null,
          artisans: [],
          workshops: [],
          visit: { showrooms: [], productionWorkshops: [] },
          products: [],
          status: 'PENDING_REVIEW',
          statusReason: null,
          approvedAt: null,
        },
        { status: 201 },
      ),
    );
    await api.applyHousehold({ name: 'Gốm Bảo Châu', slug: 'gom-bao-chau', history: '' });
    expect(calls[0]?.url).toBe('/api/v1/me/household');
    expect(calls[0]?.init.method).toBe('POST');
    expect(JSON.parse(String(calls[0]?.init.body))).toMatchObject({ slug: 'gom-bao-chau' });
  });

  it('tải giấy tờ lên bằng multipart với mục đích CERTIFICATE và không tự đặt Content-Type', async () => {
    const { api, calls } = client(() =>
      Response.json(
        {
          id: userId,
          version: 0,
          purpose: 'CERTIFICATE',
          visibility: 'PRIVATE',
          status: 'READY',
          mimeType: 'application/pdf',
          sizeBytes: 4,
          sha256: 'a'.repeat(64),
          width: null,
          height: null,
          thumbhash: null,
          dominantColor: null,
          variants: [],
          createdAt: '2026-10-31T00:00:00.000Z',
        },
        { status: 202 },
      ),
    );
    await api.uploadCertificate(new Blob(['%PDF'], { type: 'application/pdf' }), 'giay-phep.pdf');
    expect(calls[0]?.url).toBe('/api/v1/media?purpose=CERTIFICATE');
    expect(calls[0]?.init.body).toBeInstanceOf(FormData);
    expect(
      (calls[0]?.init.headers as Record<string, string> | undefined)?.['Content-Type'],
    ).toBeUndefined();
  });
});
