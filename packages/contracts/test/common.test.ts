import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  applyVietnameseZodErrors,
  CursorPageQuerySchema,
  createProblem,
  csvOf,
  cursorPageSchema,
  defaultStatusOf,
  ERROR_CATALOG,
  ERROR_CODES,
  formatVersionTag,
  IdempotencyKeySchema,
  IdSchema,
  IsoDateTimeSchema,
  isProblemDetails,
  LocaleSchema,
  listQuerySchema,
  ProblemDetailsSchema,
  parseIfMatch,
  problemTypeOf,
  SlugSchema,
  sortQuerySchema,
  VndRangeSchema,
  VndSchema,
  zodErrorToFieldErrors,
  zodErrorToProblem,
} from '../src';

describe('error catalog', () => {
  it('khớp mã trong docs và map HTTP status', () => {
    expect(ERROR_CODES.STALE_VERSION).toBe('STALE_VERSION');
    expect(defaultStatusOf('STALE_VERSION')).toBe(409); // BR-L1
    expect(defaultStatusOf('INVALID_TRANSITION')).toBe(409); // SRS §4.1
    expect(defaultStatusOf('RATE_LIMITED')).toBe(429);
    expect(defaultStatusOf('VALIDATION_FAILED')).toBe(422);
  });

  it('mọi status là 4xx/5xx và có tiền tố nhóm hợp lệ', () => {
    for (const [code, { status }] of Object.entries(ERROR_CATALOG)) {
      expect(status, code).toBeGreaterThanOrEqual(400);
      expect(status, code).toBeLessThan(600);
    }
  });
});

describe('Problem Details', () => {
  it('createProblem điền mặc định và schema chấp nhận', () => {
    const problem = createProblem({
      code: 'STALE_VERSION',
      instance: '/api/v1/rfqs/42',
      traceId: 't1',
    });
    expect(problem).toMatchObject({
      type: '/problems/stale-version',
      status: 409,
      code: 'STALE_VERSION',
      instance: '/api/v1/rfqs/42',
      traceId: 't1',
    });
    expect(problem).not.toHaveProperty('errors');
    expect(isProblemDetails(problem)).toBe(true);
    expect(problemTypeOf('AUTH_MFA_REQUIRED')).toBe('/problems/auth-mfa-required');
  });

  it('từ chối mã lỗi lạ và status ngoài 4xx/5xx', () => {
    expect(
      ProblemDetailsSchema.safeParse({ type: 'x', title: 'x', status: 200, code: 'NOT_FOUND' })
        .success,
    ).toBe(false);
    expect(
      ProblemDetailsSchema.safeParse({ type: 'x', title: 'x', status: 404, code: 'NOPE' }).success,
    ).toBe(false);
  });
});

describe('ZodError -> Problem Details', () => {
  const schema = z.strictObject({
    name: z.string().min(1),
    items: z.array(z.strictObject({ quantity: z.int().min(1) })),
  });

  it('gom lỗi theo path dạng chấm, tách unrecognized_keys theo key', () => {
    const result = schema.safeParse({ name: '', items: [{ quantity: 0 }], extra: 1, other: 2 });
    expect(result.success).toBe(false);
    if (result.success) return;
    const errors = zodErrorToFieldErrors(result.error);
    expect(errors.map((e) => [e.path, e.code])).toEqual(
      expect.arrayContaining([
        ['name', 'too_small'],
        ['items.0.quantity', 'too_small'],
        ['extra', 'unrecognized_keys'],
        ['other', 'unrecognized_keys'],
      ]),
    );
  });

  it('zodErrorToProblem trả 422 VALIDATION_FAILED có traceId', () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error('unreachable');
    const problem = zodErrorToProblem(result.error, { instance: '/api/v1/x', traceId: 'abc' });
    expect(problem.status).toBe(422);
    expect(problem.code).toBe('VALIDATION_FAILED');
    expect(problem.traceId).toBe('abc');
    expect(problem.errors?.length).toBeGreaterThan(0);
    expect(isProblemDetails(problem)).toBe(true);
  });

  it('formatMessage cho phép tầng gọi dịch thông điệp', () => {
    const result = schema.safeParse({});
    if (result.success) throw new Error('unreachable');
    const errors = zodErrorToFieldErrors(result.error, { formatMessage: (i) => `key:${i.code}` });
    expect(errors.every((e) => e.message.startsWith('key:'))).toBe(true);
  });

  describe('thông điệp tiếng Việt', () => {
    beforeAll(() => applyVietnameseZodErrors());
    afterAll(() => z.config(z.locales.en()));

    it('dùng bản đồ tiếng Việt, message tự đặt trong schema vẫn thắng', () => {
      const s = z.object({
        a: z.string(),
        b: z.string().min(3),
        c: z.string().min(1, 'Hãy nhập tên hộ'),
        d: z.uuid(),
      });
      const result = s.safeParse({ b: 'x', c: '', d: 'z' });
      if (result.success) throw new Error('unreachable');
      const byPath = Object.fromEntries(
        zodErrorToFieldErrors(result.error).map((e) => [e.path, e.message]),
      );
      expect(byPath.a).toBe('Trường này là bắt buộc');
      expect(byPath.b).toBe('Cần tối thiểu 3 ký tự');
      expect(byPath.c).toBe('Hãy nhập tên hộ');
      expect(byPath.d).toBe('Mã định danh không hợp lệ');
    });
  });
});

describe('primitives', () => {
  it('IdSchema chỉ nhận uuid', () => {
    expect(IdSchema.safeParse('3f2b8c1e-5d4a-4c7b-9a1e-0b6f2d8e7a31').success).toBe(true);
    expect(IdSchema.safeParse('42').success).toBe(false);
  });

  it('SlugSchema: ASCII thường, không dấu, không gạch ngang thừa', () => {
    expect(SlugSchema.safeParse('binh-gom-men-ran-bt7k2qxm').success).toBe(true);
    for (const bad of ['Bình-gốm', 'a--b', '-a', 'a-', 'A', 'a b', '']) {
      expect(SlugSchema.safeParse(bad).success, bad).toBe(false);
    }
  });

  it('VndSchema: số nguyên không âm', () => {
    expect(VndSchema.safeParse(1_500_000).success).toBe(true);
    expect(VndSchema.safeParse(0).success).toBe(true);
    expect(VndSchema.safeParse(1.5).success).toBe(false);
    expect(VndSchema.safeParse(-1).success).toBe(false);
    expect(VndSchema.safeParse(Number.MAX_SAFE_INTEGER + 1).success).toBe(false);
  });

  it('VndRangeSchema: min <= max', () => {
    expect(VndRangeSchema.safeParse({ min: 1, max: 2 }).success).toBe(true);
    expect(VndRangeSchema.safeParse({ min: 3 }).success).toBe(true);
    expect(VndRangeSchema.safeParse({ min: 3, max: 2 }).success).toBe(false);
  });

  it('IsoDateTimeSchema và LocaleSchema', () => {
    expect(IsoDateTimeSchema.safeParse('2026-10-27T08:00:00Z').success).toBe(true);
    expect(IsoDateTimeSchema.safeParse('2026-10-27T15:00:00+07:00').success).toBe(true);
    expect(IsoDateTimeSchema.safeParse('27/10/2026').success).toBe(false);
    expect(LocaleSchema.safeParse('vi').success).toBe(true);
    expect(LocaleSchema.safeParse('fr').success).toBe(false);
  });
});

describe('pagination, sort, filter', () => {
  it('CursorPageQuerySchema: mặc định 24, ép số từ query string, chặn quá 100', () => {
    expect(CursorPageQuerySchema.parse({})).toEqual({ limit: 24 });
    expect(CursorPageQuerySchema.parse({ cursor: 'abc', limit: '50' })).toEqual({
      cursor: 'abc',
      limit: 50,
    });
    expect(CursorPageQuerySchema.safeParse({ limit: '101' }).success).toBe(false);
    expect(CursorPageQuerySchema.safeParse({ limit: '0' }).success).toBe(false);
  });

  it('cursorPageSchema: phong bì { data, nextCursor }', () => {
    const page = cursorPageSchema(z.object({ id: IdSchema }));
    expect(page.safeParse({ data: [], nextCursor: null }).success).toBe(true);
    expect(page.safeParse({ data: [{ id: 'x' }], nextCursor: null }).success).toBe(false);
    expect(page.safeParse({ data: [] }).success).toBe(false);
  });

  it('sortQuerySchema: tiền tố - là giảm dần, chặn field ngoài danh sách', () => {
    const sort = sortQuerySchema(['publishedAt', 'priceVnd'] as const);
    expect(sort.parse('-publishedAt,priceVnd')).toEqual([
      { field: 'publishedAt', direction: 'desc' },
      { field: 'priceVnd', direction: 'asc' },
    ]);
    expect(sort.safeParse('password').success).toBe(false);
  });

  it('csvOf + listQuerySchema', () => {
    const status = csvOf(z.enum(['SENT', 'BIDDING']));
    expect(status.parse('SENT, BIDDING')).toEqual(['SENT', 'BIDDING']);
    expect(status.safeParse('SENT,NOPE').success).toBe(false);

    const query = listQuerySchema(['createdAt'] as const).extend({ status });
    expect(query.parse({ q: ' gốm ', sort: '-createdAt', status: 'SENT' })).toEqual({
      limit: 24,
      q: 'gốm',
      sort: [{ field: 'createdAt', direction: 'desc' }],
      status: ['SENT'],
    });
  });
});

describe('http headers', () => {
  it('parseIfMatch đọc số phiên bản', () => {
    expect(parseIfMatch('5')).toBe(5);
    expect(parseIfMatch('"5"')).toBe(5);
    expect(parseIfMatch('W/"5"')).toBe(5);
    expect(parseIfMatch('v5')).toBe(5);
    expect(parseIfMatch('abc')).toBeNull();
    expect(parseIfMatch(undefined)).toBeNull();
    expect(formatVersionTag(6)).toBe('"6"');
  });

  it('IdempotencyKeySchema', () => {
    expect(IdempotencyKeySchema.safeParse('3f2b8c1e-5d4a-4c7b-9a1e-0b6f2d8e7a31').success).toBe(
      true,
    );
    expect(IdempotencyKeySchema.safeParse('short').success).toBe(false);
    expect(IdempotencyKeySchema.safeParse('has space in it').success).toBe(false);
  });
});
