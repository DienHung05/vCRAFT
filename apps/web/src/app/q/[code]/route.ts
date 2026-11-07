import { defaultLocale, type Locale, locales, pathnames } from '@vcraft/i18n';
import { after, type NextRequest } from 'next/server';
import { apiBaseUrl } from '@/lib/api/internal-url';
import { scanCountry, scanDeviceType } from '@/lib/scan-context';

/** Tên cookie ngôn ngữ mà next-intl ghi khi người dùng đã chọn ngôn ngữ. */
const LOCALE_COOKIE = 'NEXT_LOCALE';

const isLocale = (value: string | undefined): value is Locale =>
  (locales as readonly string[]).includes(value ?? '');

/** Chọn ngôn ngữ theo `Accept-Language` (trọng số q giảm dần); không khớp thì mặc định. */
function negotiate(header: string | null): Locale {
  const ranked = (header ?? '')
    .split(',')
    .map((part) => {
      const [tag = '', ...params] = part.trim().split(';');
      const q = Number(params.find((p) => p.trim().startsWith('q='))?.split('=')[1] ?? 1);
      return { lang: tag.trim().toLowerCase().split('-')[0], q: Number.isNaN(q) ? 0 : q };
    })
    .filter((x) => x.q > 0)
    .sort((a, b) => b.q - a.q);
  return ranked.map((x) => x.lang).find(isLocale) ?? defaultLocale;
}

/**
 * Mã QR ngắn `/q/<code>` (FR-TRC-02/03) chuyển hướng tới trang truy xuất theo ngôn ngữ: cookie người
 * dùng đã chọn, rồi `Accept-Language`, mặc định tiếng Việt. Dùng 308 theo FR-TRC-03; đích phụ thuộc người
 * quét nên kèm `Vary`. Location để tương đối, tránh lộ origin nội bộ khi đứng sau reverse proxy.
 *
 * Trang đích mới là nơi quyết định mã có tồn tại không: mã đúng định dạng nhưng không có trong hệ thống
 * hiện cảnh báo hàng không xác thực (FR-TRC-08), mã sai định dạng trả 404.
 */
export async function GET(request: NextRequest, ctx: RouteContext<'/q/[code]'>): Promise<Response> {
  const { code } = await ctx.params;
  // Đếm lượt quét không được làm chậm hay chặn người quét: lỗi thì bỏ qua (FR-ADM-06).
  // `after()` runs once the 308 is sent and keeps the serverless function alive until it finishes (a
  // dangling `fetch` is frozen by Vercel and never completes). Only the country and the device class go to
  // the API (FR-TRC-06); the IP address is never read, sent or stored.
  const scan = {
    country: scanCountry(request.headers.get('x-vercel-ip-country')),
    deviceType: scanDeviceType(request.headers.get('user-agent')),
  };
  after(async () => {
    try {
      await fetch(`${apiBaseUrl()}/trace/${encodeURIComponent(code)}/scan`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(scan),
        signal: AbortSignal.timeout(1500),
      });
    } catch {
      // A lost scan is better than a broken redirect.
    }
  });
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  const locale = isLocale(cookie) ? cookie : negotiate(request.headers.get('accept-language'));
  // `routing` dùng localePrefix mặc định ('always'): đích là `/<locale><pathname bản địa hóa>`.
  const location = `/${locale}${pathnames['/truy-xuat/[code]'][locale].replace('[code]', encodeURIComponent(code))}`;
  return new Response(null, {
    status: 308,
    headers: { Location: location, Vary: 'Accept-Language, Cookie' },
  });
}
