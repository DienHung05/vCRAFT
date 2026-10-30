import type { EntityManager } from '@mikro-orm/core';
import { type ChainEntry, verifyChain } from '@vcraft/domain';
import {
  AppUser,
  CooperativeQuotation,
  Household,
  JournalEntry,
  News,
  OrderAllocation,
  Product,
  QuotationRequest,
} from '../../entities/index.js';
import {
  DEMO_ACCOUNT_LIST,
  DEMO_HOUSEHOLD_IDS,
  DEMO_QR_TRACE_CODE,
  DEMO_REQUEST_IDS,
} from './accounts.js';

export interface DemoCheck {
  name: string;
  ok: boolean;
  detail: string;
}

export interface DemoVerifyReport {
  ok: boolean;
  checks: DemoCheck[];
}

/** Yêu cầu phải còn mở khi thi (demo trực tiếp thao tác trên chúng). */
const MUST_STAY_OPEN = [
  'sentOptIn',
  'sentCoordinated',
  'biddingToAccept',
  'biddingReplaced',
] as const;
const MIN_OPEN_DAYS = 3;

/**
 * Kiểm dữ liệu demo "còn nguyên" (pre-exam check trên dữ liệu đóng băng), chỉ đọc. Dùng trong
 * `pnpm demo:verify` và test tích hợp. Không kiểm Supabase Auth (xem `scripts/demo-auth.mjs --check`).
 */
export async function verifyDemoData(
  em: EntityManager,
  now: Date = new Date(),
): Promise<DemoVerifyReport> {
  const checks: DemoCheck[] = [];
  const add = (name: string, ok: boolean, detail: string) => checks.push({ name, ok, detail });

  const households = await em.count(Household);
  const pending = await em.count(Household, { status: 'PENDING_REVIEW' });
  add(
    'Hộ: ≥ 20 (gồm 1 hộ chờ duyệt)',
    households >= 20 && pending === 1,
    `${households} hộ, ${pending} chờ duyệt`,
  );

  const products = await em.find(Product, {}, { fields: ['id', 'traceCode', 'status'] });
  add('Sản phẩm: ≥ 200', products.length >= 200, `${products.length} sản phẩm`);

  const entries = await em.find(
    JournalEntry,
    {},
    { populate: ['supersedes'], orderBy: { seq: 'asc' } },
  );
  const byProduct = new Map<string, JournalEntry[]>();
  for (const entry of entries) {
    const list = byProduct.get(entry.product.id) ?? [];
    list.push(entry);
    byProduct.set(entry.product.id, list);
  }
  const badLength: string[] = [];
  const brokenChain: string[] = [];
  for (const product of products) {
    const list = byProduct.get(product.id) ?? [];
    if (list.length < 4 || list.length > 7) badLength.push(product.traceCode);
    const chain: ChainEntry[] = list.map((e) => ({
      seq: e.seq,
      stage: e.stage,
      at: e.declaredDate,
      note: e.note,
      mediaChecksums: e.images.map((image) => image.sha256),
      supersedesSeq: e.supersedes?.seq,
      skipReason: e.skipReason ?? undefined,
      prevHash: e.prevHash,
      hash: e.hash,
    }));
    if (!(await verifyChain(product.id, chain)).ok) brokenChain.push(product.traceCode);
  }
  add(
    'Nhật ký: mỗi sản phẩm 4–7 mốc',
    badLength.length === 0,
    badLength.length === 0 ? `${entries.length} mốc` : `sai ở ${badLength.slice(0, 5).join(', ')}`,
  );
  add(
    'Nhật ký: chuỗi băm SHA-256 toàn vẹn',
    brokenChain.length === 0,
    brokenChain.length === 0 ? 'mọi chuỗi hợp lệ' : `gãy ở ${brokenChain.slice(0, 5).join(', ')}`,
  );

  const qr = products.find((p) => p.traceCode === DEMO_QR_TRACE_CODE);
  const qrEntries = qr ? (byProduct.get(qr.id) ?? []).length : 0;
  add(
    `Mã QR cố định ${DEMO_QR_TRACE_CODE}`,
    qr?.status === 'PUBLISHED' && qrEntries === 7,
    qr ? `${qr.status}, ${qrEntries} mốc` : 'không tìm thấy',
  );

  const requests = await em.find(QuotationRequest, {});
  const statuses = new Set(requests.map((r) => r.status));
  add(
    'Yêu cầu báo giá: 12, đủ 8 trạng thái',
    requests.length === 12 && statuses.size === 8,
    `${requests.length} yêu cầu, ${statuses.size} trạng thái`,
  );

  const production = requests.filter((r) => r.status === 'IN_PRODUCTION');
  let splitHouseholds = 0;
  if (production.length === 1) {
    const accepted = await em.findOne(CooperativeQuotation, {
      request: production[0],
      status: 'ACCEPTED',
    });
    if (accepted) {
      const allocations = await em.find(OrderAllocation, { quotation: accepted });
      splitHouseholds = new Set(allocations.map((a) => a.household.id)).size;
    }
  }
  add(
    'Đơn IN_PRODUCTION chia đúng 4 hộ',
    production.length === 1 && splitHouseholds === 4,
    `${production.length} đơn, ${splitHouseholds} hộ`,
  );

  const publishedNews = await em.count(News, { status: 'PUBLISHED' });
  const pinnedNews = await em.count(News, { status: 'PUBLISHED', pinned: true });
  const villageNews = await em.count(News, { status: 'PUBLISHED', household: null });
  add(
    'Tin tức: ≥ 15 tin đã đăng (có tin ghim, tin chung và tin của hộ)',
    publishedNews >= 15 && pinnedNews >= 1 && villageNews >= 1 && villageNews < publishedNews,
    `${publishedNews} tin, ${pinnedNews} ghim, ${villageNews} tin chung`,
  );

  const missingAccounts: string[] = [];
  for (const account of DEMO_ACCOUNT_LIST) {
    const user = await em.findOne(AppUser, account.id);
    if (!user || user.role !== account.role || user.status !== 'ACTIVE')
      missingAccounts.push(account.key);
  }
  add(
    'Bốn tài khoản cố định đúng vai trò',
    missingAccounts.length === 0,
    missingAccounts.length === 0
      ? 'đủ admin, buyer, household, pending'
      : `thiếu/sai: ${missingAccounts.join(', ')}`,
  );

  const pendingHousehold = await em.findOne(Household, DEMO_HOUSEHOLD_IDS.pending);
  add(
    'Hộ chờ duyệt còn PENDING_REVIEW (chưa ai duyệt)',
    pendingHousehold?.status === 'PENDING_REVIEW',
    pendingHousehold?.status ?? 'không tìm thấy',
  );

  const drafts = await em.count(Product, {
    household: DEMO_HOUSEHOLD_IDS.household,
    status: 'DRAFT',
  });
  add('Hộ household còn ≥ 1 sản phẩm nháp để xuất bản', drafts >= 1, `${drafts} bản nháp`);

  const stale: string[] = [];
  for (const key of MUST_STAY_OPEN) {
    const request = requests.find((r) => r.id === DEMO_REQUEST_IDS[key]);
    const daysLeft = request
      ? (request.biddingClosesAt.getTime() - now.getTime()) / 86_400_000
      : -1;
    if (!request || daysLeft < MIN_OPEN_DAYS) stale.push(`${key} (${daysLeft.toFixed(1)} ngày)`);
  }
  add(
    `Hạn chào giá của 4 yêu cầu demo còn ≥ ${MIN_OPEN_DAYS} ngày`,
    stale.length === 0,
    stale.length === 0 ? 'còn hạn' : `sắp/đã hết hạn: ${stale.join(', ')}; chạy lại demo:reset`,
  );

  return { ok: checks.every((c) => c.ok), checks };
}
