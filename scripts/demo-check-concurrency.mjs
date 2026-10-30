#!/usr/bin/env node
/**
 * Pre-exam: hai "tab" cùng giữ một phiên bản cũ, bấm cùng lúc, đúng MỘT bên thành công, bên kia bị từ chối
 * `STALE_VERSION` (409, BR-L1). Dùng hai phiên đăng nhập admin riêng và `If-Match` giống nhau.
 *
 * Thao tác thật: admin nhận điều phối yêu cầu `sentOptIn`. Lệnh GHI vào dữ liệu ⇒ chạy xong phải
 * `pnpm demo:reset` để trả dữ liệu về trạng thái đóng băng. Chạy lại khi chưa reset sẽ báo "đã nhận điều phối".
 *
 * Cần: DEMO_API_URL (hoặc E2E_BASE_URL), SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, DEMO_ADMIN_PASSWORD.
 */
import { apiBase, loadDemoAccounts, printResult, signIn } from './lib/demo-common.mjs';

const accounts = await loadDemoAccounts();
const api = apiBase();
const requestId = accounts.DEMO_REQUEST_IDS.sentOptIn;

const [tabA, tabB] = await Promise.all([signIn(accounts, 'admin'), signIn(accounts, 'admin')]);
const call = (session, method, path, headers = {}) =>
  fetch(`${api}${path}`, {
    method,
    headers: { authorization: `Bearer ${session.access_token}`, ...headers },
  });

const read = await call(tabA, 'GET', `/rfqs/${requestId}`);
if (!read.ok) {
  console.error(`Không đọc được yêu cầu ${requestId}: HTTP ${read.status}`);
  process.exit(1);
}
const rfq = await read.json();
if (rfq.status !== 'SENT') {
  console.error(
    `Yêu cầu đang ở ${rfq.status}, không phải SENT: chạy "pnpm demo:reset" rồi thử lại.`,
  );
  process.exit(1);
}
const etag = read.headers.get('etag') ?? `"${rfq.version}"`;

const [a, b] = await Promise.all([
  call(tabA, 'POST', `/rfqs/${requestId}/coordinate`, { 'if-match': etag }),
  call(tabB, 'POST', `/rfqs/${requestId}/coordinate`, { 'if-match': etag }),
]);
const statuses = [a.status, b.status].sort((x, y) => x - y);
const loser = a.status === 409 ? a : b;
const problem = loser.status === 409 ? await loser.json() : null;

const exactlyOne = statuses[0] === 200 && statuses[1] === 409;
printResult('Đúng một tab thành công, một tab bị 409', exactlyOne, `HTTP ${statuses.join(' + ')}`);
printResult(
  'Tab thua nhận mã STALE_VERSION',
  problem?.code === 'STALE_VERSION',
  problem?.code ?? 'không có',
);
const ok = exactlyOne && problem?.code === 'STALE_VERSION';
console.log(
  ok
    ? '\ndemo:check:concurrency: ĐẠT (nhớ chạy pnpm demo:reset)'
    : '\ndemo:check:concurrency: KHÔNG ĐẠT',
);
process.exit(ok ? 0 : 1);
