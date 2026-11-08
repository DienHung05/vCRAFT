import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Thư mục gốc monorepo. */
export const ROOT = join(dirname(new URL(import.meta.url).pathname), '..', '..', '..');

/**
 * Nạp một dependency theo vị trí của workspace khác (pnpm không hoist lên gốc), vd.
 * `importFrom('apps/api', '@supabase/supabase-js')`. Nhờ vậy không phải thêm dependency vào package.json gốc.
 */
export async function importFrom(workspaceDir, specifier) {
  const require = createRequire(join(ROOT, workspaceDir, 'package.json'));
  return import(pathToFileURL(require.resolve(specifier)).href);
}

/** Tài khoản và id demo cố định, đọc thẳng file TS không phụ thuộc (Node tự bỏ kiểu). */
export function loadDemoAccounts() {
  return import(pathToFileURL(join(ROOT, 'packages/database/src/seeders/demo/accounts.ts')).href);
}

/** Đọc một biến môi trường theo tên (dạng động để biome/turbo không đòi khai báo từng biến). */
export function envOf(name) {
  return process.env[name];
}

/** Đọc các biến môi trường bắt buộc; thiếu thì in tên biến và thoát mã 2. */
export function requireEnv(names) {
  const missing = names.filter((name) => !process.env[name]?.trim());
  if (missing.length > 0) {
    console.error(
      `Thiếu biến môi trường: ${missing.join(', ')} (xem docs/demo/README.md và .env.example)`,
    );
    process.exit(2);
  }
  return Object.fromEntries(names.map((name) => [name, process.env[name].trim()]));
}

/** Địa chỉ API: `DEMO_API_URL`, nếu không thì `<E2E_BASE_URL>/api/v1`. */
export function apiBase() {
  const explicit = envOf('DEMO_API_URL')?.trim();
  if (explicit) return explicit.replace(/\/$/, '');
  const base = envOf('E2E_BASE_URL')?.trim();
  if (!base) {
    console.error('Thiếu DEMO_API_URL hoặc E2E_BASE_URL (địa chỉ bản đã triển khai).');
    process.exit(2);
  }
  return `${base.replace(/\/$/, '')}/api/v1`;
}

/** Signs a demo account in with its username, returning the API token pair (a fresh session per call).
 *
 * GH#212: the identifier sent to `POST /auth/sign-in` is the USERNAME, no longer the email.
 */
export async function signIn(accounts, key) {
  const account = accounts.DEMO_ACCOUNTS[key];
  const [api, password] = [apiBase(), requireEnv([account.passwordEnv])[account.passwordEnv]];
  const username = envOf(`DEMO_${key.toUpperCase()}_USERNAME`)?.trim() || account.username;
  const response = await fetch(`${api}/auth/sign-in`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ identifier: username, password }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(
      `Sign-in failed for ${key} (${username}): HTTP ${response.status} ${detail.code ?? ''}`,
    );
  }
  const data = await response.json();
  if (!data.access_token || !data.refresh_token) {
    throw new Error(`Sign-in failed for ${key} (${username}): token pair missing from response`);
  }
  return { access_token: data.access_token, refresh_token: data.refresh_token };
}

export function printResult(name, ok, detail) {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  [${detail}]` : ''}`);
}
