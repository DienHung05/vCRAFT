#!/usr/bin/env node
/**
 * Tạo/cập nhật bốn người dùng Supabase Auth của demo với ĐÚNG id cố định (= `app_user.id`, ARCHITECTURE §7.5),
 * email đã xác nhận, mật khẩu lấy từ biến môi trường. Chạy lại bao nhiêu lần cũng được (idempotent).
 *
 *   pnpm demo:auth            tạo hoặc cập nhật
 *   pnpm demo:auth -- --check chỉ kiểm tra tài khoản đã đúng id/email chưa, không ghi gì
 *
 * Cần: APP_ENV=demo, SUPABASE_URL, SUPABASE_SECRET_KEY và DEMO_{ADMIN,BUYER,HOUSEHOLD,PENDING}_PASSWORD.
 * `auth.admin.createUser` nhận `id` (AdminUserAttributes.id, @supabase/auth-js ≥ 2.x), nên không cần cách vòng.
 * Nếu một email demo đã gắn với người dùng id KHÁC, script dừng và nói rõ (xóa người dùng đó ở Dashboard > Authentication).
 */
import {
  envOf,
  importFrom,
  loadDemoAccounts,
  printResult,
  requireEnv,
} from './lib/demo-common.mjs';

const checkOnly = process.argv.includes('--check');

if (envOf('APP_ENV')?.trim().toLowerCase() !== 'demo') {
  console.error(
    'demo:auth TỪ CHỐI: APP_ENV phải là "demo" (script ghi vào Supabase Auth của dự án đang trỏ tới).',
  );
  process.exit(2);
}

const accounts = await loadDemoAccounts();
const list = accounts.DEMO_ACCOUNT_LIST;
const env = requireEnv([
  'SUPABASE_URL',
  'SUPABASE_SECRET_KEY',
  ...(checkOnly ? [] : list.map((account) => account.passwordEnv)),
]);
const { createClient } = await importFrom('apps/api', '@supabase/supabase-js');
const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
}).auth.admin;

let failed = false;
for (const account of list) {
  const { data: byId } = await admin.getUserById(account.id);
  if (checkOnly) {
    const ok = byId?.user?.email === account.email && Boolean(byId.user.email_confirmed_at);
    printResult(
      `${account.key} (${account.email})`,
      ok,
      ok ? account.id : 'chưa có hoặc sai email/xác nhận',
    );
    failed ||= !ok;
    continue;
  }
  const attributes = {
    email: account.email,
    password: process.env[account.passwordEnv].trim(),
    email_confirm: true,
    user_metadata: { full_name: account.fullName, sample_data: true },
  };
  const { error } = byId?.user
    ? await admin.updateUserById(account.id, attributes)
    : await admin.createUser({ id: account.id, ...attributes });
  if (error) {
    failed = true;
    const hint = /already|registered|exists/i.test(error.message)
      ? ' (email này đã gắn với người dùng khác id: xóa người dùng đó ở Dashboard > Authentication rồi chạy lại)'
      : '';
    printResult(`${account.key} (${account.email})`, false, `${error.message}${hint}`);
  } else {
    printResult(
      `${account.key} (${account.email})`,
      true,
      `${byId?.user ? 'đã cập nhật' : 'đã tạo'} ${account.id}`,
    );
  }
}
process.exit(failed ? 1 : 0);
