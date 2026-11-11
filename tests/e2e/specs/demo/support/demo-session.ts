import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { BrowserContext } from '@playwright/test';

/**
 * Hỗ trợ cho kịch bản demo chạy trên bản đã triển khai (`E2E_BASE_URL`) với ba hồ sơ đăng nhập sẵn.
 *
 * Kịch bản demo chèn cookie phiên cho nhanh (đăng nhập qua form có ở specs/buyer/sign-in.spec.ts): trình duyệt đọc phiên Supabase từ cookie do `@supabase/ssr` ghi
 * (`sb-<project-ref>-auth-token`, giá trị `base64-` + base64url(JSON phiên), cắt từng đoạn 3180 ký tự).
 * Nên ta đăng nhập bằng REST của Supabase Auth rồi chèn đúng định dạng cookie đó vào context. Không thêm dependency.
 * Mật khẩu chỉ đọc từ biến môi trường (`DEMO_*_PASSWORD`), không có trong mã.
 */

// Playwright không tự nạp .env; nạp .env gốc nếu có (không ghi đè biến đã đặt).
const envFile = resolve(__dirname, '../../../../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

export const DEMO_ACCOUNT_KEYS = ['buyer', 'household', 'admin'] as const;
export type DemoAccountKey = (typeof DEMO_ACCOUNT_KEYS)[number];

/** Khớp packages/database/src/seeders/demo/accounts.ts (sao chép để e2e không import mã ORM). */
export const DEMO = {
  accounts: {
    admin: { email: 'demo.admin@example.com', passwordEnv: 'DEMO_ADMIN_PASSWORD' },
    buyer: { email: 'demo.buyer@example.com', passwordEnv: 'DEMO_BUYER_PASSWORD' },
    household: { email: 'demo.household@example.com', passwordEnv: 'DEMO_HOUSEHOLD_PASSWORD' },
  },
  qrTraceCode: 'DF6P3WZE',
  householdSlug: 'lo-duc-phat',
  pendingHouseholdId: 'd3a10000-0000-4000-8000-000000000201',
  requests: {
    sentOptIn: 'd3a10000-0000-4000-8000-000000000104',
    biddingToAccept: 'd3a10000-0000-4000-8000-000000000106',
    acceptedConfirm: 'd3a10000-0000-4000-8000-000000000108',
    inProduction: 'd3a10000-0000-4000-8000-000000000110',
    biddingDirect: 'd3a10000-0000-4000-8000-000000000113',
    sentDirect: 'd3a10000-0000-4000-8000-000000000114',
  },
} as const;

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user: unknown;
}

const supabaseUrl = () => process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = () =>
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

/** Lý do phải bỏ qua kịch bản (thiếu bản triển khai hoặc thông tin đăng nhập), hoặc `undefined` nếu chạy được. */
export function demoSkipReason(): string | undefined {
  if (!process.env.E2E_BASE_URL) return 'Thiếu E2E_BASE_URL (địa chỉ bản đã triển khai).';
  if (!supabaseUrl() || !publishableKey()) {
    return 'Thiếu SUPABASE_URL / SUPABASE_PUBLISHABLE_KEY để đăng nhập các hồ sơ demo.';
  }
  const missing = DEMO_ACCOUNT_KEYS.map((key) => DEMO.accounts[key].passwordEnv).filter(
    (name) => !process.env[name],
  );
  return missing.length > 0 ? `Thiếu mật khẩu demo: ${missing.join(', ')}.` : undefined;
}

/** Đăng nhập email/mật khẩu qua REST của Supabase Auth; mỗi lần gọi là một phiên mới.
 *
 * GH#212: the cookie-injection scenario still goes straight to Supabase (not through the form),
 * because it needs the exact `@supabase/ssr` response; the UI scenario signs in with the username
 * through the real form.
 */
export async function signIn(key: DemoAccountKey): Promise<SupabaseSession> {
  const account = DEMO.accounts[key];
  const response = await fetch(`${supabaseUrl()}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: publishableKey() ?? '', 'content-type': 'application/json' },
    body: JSON.stringify({ email: account.email, password: process.env[account.passwordEnv] }),
  });
  if (!response.ok) throw new Error(`Đăng nhập ${key} thất bại: HTTP ${response.status}`);
  return (await response.json()) as SupabaseSession;
}

/** Cookie phiên đúng định dạng `@supabase/ssr` (tên cookie lấy từ ref dự án trong SUPABASE_URL). */
export function sessionCookies(session: SupabaseSession, baseUrl: string) {
  const ref = new URL(supabaseUrl() ?? '').hostname.split('.')[0];
  const name = `sb-${ref}-auth-token`;
  const value = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
  const chunkSize = 3180;
  const chunks =
    value.length <= chunkSize
      ? [{ name, value }]
      : Array.from({ length: Math.ceil(value.length / chunkSize) }, (_, i) => ({
          name: `${name}.${i}`,
          value: value.slice(i * chunkSize, (i + 1) * chunkSize),
        }));
  return chunks.map((chunk) => ({
    ...chunk,
    url: baseUrl,
    httpOnly: false,
    sameSite: 'Lax' as const,
  }));
}

/** Đăng nhập sẵn một context: chèn cookie phiên rồi trả phiên để gọi API khi UI chưa có màn tương ứng. */
export async function loginContext(
  context: BrowserContext,
  key: DemoAccountKey,
  baseUrl: string,
): Promise<SupabaseSession> {
  const session = await signIn(key);
  await context.addCookies(sessionCookies(session, baseUrl));
  return session;
}

/** Gọi API `/api/v1` bằng phiên đã đăng nhập (chỉ cho bước thật sự chưa có màn hình; hiện không bước nào của kịch bản demo dùng). */
export async function callApi<T = unknown>(
  session: SupabaseSession,
  baseUrl: string,
  method: 'GET' | 'POST',
  path: string,
  options: { version?: number; body?: unknown } = {},
): Promise<{ status: number; body: T; etag: string | null }> {
  const response = await fetch(`${baseUrl}/api/v1${path}`, {
    method,
    headers: {
      authorization: `Bearer ${session.access_token}`,
      ...(options.body !== undefined && { 'content-type': 'application/json' }),
      ...(options.version !== undefined && { 'if-match': `"${options.version}"` }),
    },
    ...(options.body !== undefined && { body: JSON.stringify(options.body) }),
  });
  const text = await response.text();
  return {
    status: response.status,
    body: (text ? JSON.parse(text) : undefined) as T,
    etag: response.headers.get('etag'),
  };
}
