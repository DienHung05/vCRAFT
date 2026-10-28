// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/q/[code]/route';
import { isTraceCode, traceShortUrl } from '@/lib/site';

function call(code: string, init: { accept?: string; cookie?: string } = {}) {
  const headers = new Headers();
  if (init.accept) headers.set('accept-language', init.accept);
  if (init.cookie) headers.set('cookie', init.cookie);
  // NextRequest cần cho `request.cookies`; dựng tối thiểu đủ dùng cho route.
  const request = Object.assign(new Request(`http://internal:3000/q/${code}`, { headers }), {
    cookies: {
      get: (name: string) => {
        const m = new RegExp(`(?:^|; )${name}=([^;]*)`).exec(init.cookie ?? '');
        return m?.[1] ? { value: m[1] } : undefined;
      },
    },
  });
  return GET(request as never, { params: Promise.resolve({ code }) } as never);
}

describe('GET /q/[code] (FR-TRC-03)', () => {
  it('mặc định chuyển sang trang truy xuất tiếng Việt bằng 308, Location tương đối', async () => {
    const res = await call('BT7K2QXM');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).toBe('/vi/truy-xuat/BT7K2QXM');
  });

  it('theo Accept-Language: en ⇒ /en/trace/<code>', async () => {
    const res = await call('BT7K2QXM', { accept: 'en-US,en;q=0.9,vi;q=0.5' });
    expect(res.headers.get('location')).toBe('/en/trace/BT7K2QXM');
  });

  it('chọn ngôn ngữ có trọng số cao nhất được hỗ trợ; không hỗ trợ ⇒ vi', async () => {
    expect(
      (await call('BT7K2QXM', { accept: 'fr,vi;q=0.4,en;q=0.8' })).headers.get('location'),
    ).toBe('/en/trace/BT7K2QXM');
    expect((await call('BT7K2QXM', { accept: 'fr,de' })).headers.get('location')).toBe(
      '/vi/truy-xuat/BT7K2QXM',
    );
  });

  it('cookie NEXT_LOCALE thắng Accept-Language', async () => {
    const res = await call('BT7K2QXM', { accept: 'vi', cookie: 'NEXT_LOCALE=en' });
    expect(res.headers.get('location')).toBe('/en/trace/BT7K2QXM');
  });

  it('mã được mã hóa an toàn trong Location', async () => {
    const res = await call('a/../b?x=1');
    expect(res.status).toBe(308);
    expect(res.headers.get('location')).not.toContain('?');
    expect(res.headers.get('location')).not.toContain('/../');
  });
});

describe('định dạng mã truy xuất và URL QR', () => {
  it('nhận mã đúng bảng ký tự BR-04, không phân biệt hoa thường', () => {
    expect(isTraceCode('BT7K2QXM')).toBe(true);
    expect(isTraceCode('bt7k2qxm')).toBe(true);
    expect(isTraceCode('LN4R8TPA')).toBe(true);
  });

  it('từ chối sai độ dài hoặc ký tự dễ nhầm (0, O, 1, I)', () => {
    for (const bad of [
      '',
      'BT7K2QX',
      'BT7K2QXMM',
      'BT7K2Q0M',
      'BT7K2QOM',
      'BT7K2Q1M',
      'BT7K2QIM',
    ]) {
      expect(isTraceCode(bad), bad).toBe(false);
    }
  });
});

describe('traceShortUrl', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('lấy origin từ NEXT_PUBLIC_SITE_URL, bỏ dấu / cuối', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://example.test/');
    expect(traceShortUrl('BT7K2QXM')).toBe('https://example.test/q/BT7K2QXM');
  });

  it('chưa cấu hình: dev dùng localhost, production dùng tên miền dự phòng', () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NODE_ENV', 'development');
    expect(traceShortUrl('BT7K2QXM')).toBe('http://localhost:3000/q/BT7K2QXM');
    vi.stubEnv('NODE_ENV', 'production');
    expect(traceShortUrl('BT7K2QXM')).toBe('https://vcraft.vn/q/BT7K2QXM');
  });
});
