// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GET } from '@/app/q/[code]/route';
import { scanCountry, scanDeviceType } from '@/lib/scan-context';
import { isTraceCode, traceShortUrl } from '@/lib/site';

// `after()` only works inside a real request; the test collects its callbacks and runs them by hand.
const afterTasks = vi.hoisted(() => [] as Array<() => unknown>);
vi.mock('next/server', () => ({ after: (task: () => unknown) => afterTasks.push(task) }));

function call(
  code: string,
  init: { accept?: string; cookie?: string; country?: string; userAgent?: string } = {},
) {
  const headers = new Headers();
  if (init.country) headers.set('x-vercel-ip-country', init.country);
  if (init.userAgent) headers.set('user-agent', init.userAgent);
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

describe('GET /q/[code] scan recording (FR-TRC-06)', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    afterTasks.length = 0;
    fetchMock.mockReset().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it('posts the scan after the response with country and device only, never the IP', async () => {
    const res = await call('BT7K2QXM', {
      country: 'vn',
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
    });
    expect(res.status).toBe(308);
    // Nothing is sent before `after()` runs, so the redirect is never delayed by the API.
    expect(fetchMock).not.toHaveBeenCalled();
    expect(afterTasks).toHaveLength(1);
    await afterTasks[0]?.();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/\/trace\/BT7K2QXM\/scan$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ country: 'VN', deviceType: 'mobile' });
    expect(JSON.stringify(init)).not.toMatch(/forwarded|x-real-ip/i);
  });

  it('sends a null country when the edge header is missing and survives an API failure', async () => {
    fetchMock.mockRejectedValue(new Error('network down'));
    const res = await call('BT7K2QXM');
    expect(res.status).toBe(308);
    await expect(afterTasks[0]?.()).resolves.toBeUndefined();
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string)).toEqual({ country: null, deviceType: 'unknown' });
  });
});

describe('scan context helpers', () => {
  it('accepts only a two-letter country', () => {
    expect(scanCountry('VN')).toBe('VN');
    expect(scanCountry(' us ')).toBe('US');
    expect(scanCountry('XX1')).toBeNull();
    expect(scanCountry('')).toBeNull();
    expect(scanCountry(null)).toBeNull();
  });

  it('buckets the User-Agent into mobile, tablet, desktop, bot or unknown', () => {
    const ua = {
      iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) Mobile/15E148',
      androidPhone: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) Chrome/120.0 Mobile Safari/537.36',
      androidTablet: 'Mozilla/5.0 (Linux; Android 14; SM-X700) Chrome/120.0 Safari/537.36',
      ipad: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) Mobile/15E148',
      desktop: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
      bot: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
    };
    expect(scanDeviceType(ua.iphone)).toBe('mobile');
    expect(scanDeviceType(ua.androidPhone)).toBe('mobile');
    expect(scanDeviceType(ua.androidTablet)).toBe('tablet');
    expect(scanDeviceType(ua.ipad)).toBe('tablet');
    expect(scanDeviceType(ua.desktop)).toBe('desktop');
    expect(scanDeviceType(ua.bot)).toBe('bot');
    expect(scanDeviceType(null)).toBe('unknown');
    expect(scanDeviceType('')).toBe('unknown');
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
