import type { EntityManager } from '@mikro-orm/core';
import { type ChainEntry, verifyChain } from '@vcraft/domain';
import {
  AppUser,
  Artisan,
  CooperativeQuotation,
  Household,
  JournalEntry,
  MediaAsset,
  MediaLink,
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
import {
  DEMO_DOCUMENT_OWNER_ID,
  DEMO_PHOTO_OWNER_ID,
  demoDocumentAssetId,
  demoPhotoAssetId,
  loadTargetResolver,
  pickDisplayVariant,
} from './link-media.js';
import { DEMO_PHOTO_LINKS, DEMO_PHOTOS, RETIRED_DEMO_PHOTO_IDS } from './photo-manifest.js';
import { NEWS } from './pools.js';
import { demoEntityId } from './seed-demo.js';
import { DEMO_VERIFICATION_DOCS } from './verification-docs.js';
import { verifyEnglishProducts } from './verify-english.js';
import { verifyProfileDepth } from './verify-profile-depth.js';

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

/** Words of the old demo disclaimers (GH#204, GH#298). */
const DEMO_DISCLAIMER = /dữ liệu mẫu|hư cấu|không phải hộ thật|dùng để trình diễn/i;
/** A name still carrying the old "(mẫu)" tag. */
const SAMPLE_NAME_SUFFIX = /\(mẫu\)/i;

export interface VerifyDemoOptions {
  /** Kiểm ảnh và giấy tờ (sau `pnpm demo:media`). Mặc định bật; tắt khi chỉ có dữ liệu seed chưa gắn ảnh. */
  media?: boolean;
  /** Gửi HEAD tới URL công khai của từng ảnh trong bucket (cần mạng). Mặc định tắt. */
  checkPublicUrls?: boolean;
}

/**
 * Kiểm dữ liệu demo "còn nguyên" (pre-exam check trên dữ liệu đóng băng), chỉ đọc. Dùng trong
 * `pnpm demo:verify` và test tích hợp. Không kiểm Supabase Auth (xem `scripts/demo/auth.mjs --check`).
 */
export async function verifyDemoData(
  em: EntityManager,
  now: Date = new Date(),
  options: VerifyDemoOptions = {},
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

  // GH#298: the old "sample data" disclaimers must be gone from every text a visitor can read.
  const disclaimed = (texts: ReadonlyArray<string | null | undefined>) =>
    texts.filter((text) => text != null && DEMO_DISCLAIMER.test(text)).length;
  const disclaimerCounts = {
    household: disclaimed(
      (await em.find(Household, {}, { fields: ['history'] })).map((h) => h.history),
    ),
    artisan: disclaimed((await em.find(Artisan, {}, { fields: ['bio'] })).map((a) => a.bio)),
    news: disclaimed(
      (await em.find(News, {}, { fields: ['title', 'body'] })).flatMap((n) => [n.title, n.body]),
    ),
    product: disclaimed(
      (await em.find(Product, {}, { fields: ['description'] })).map((p) => p.description),
    ),
    // The "(mẫu)" suffix the demo accounts used to carry in `app_user.full_name`.
    appUser: (await em.find(AppUser, {}, { fields: ['fullName'] })).filter(
      (u) => u.fullName != null && SAMPLE_NAME_SUFFIX.test(u.fullName),
    ).length,
  };
  add(
    'No demo disclaimer text',
    Object.values(disclaimerCounts).every((count) => count === 0),
    Object.entries(disclaimerCounts)
      .map(([table, count]) => `${table} ${count}`)
      .join(', '),
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
    'Tin tức: ≥ 6 tin đã đăng (có tin ghim và tin chung của làng; tin của hộ là tùy chọn)',
    publishedNews >= 6 && pinnedNews >= 1 && villageNews >= 1,
    `${publishedNews} tin, ${pinnedNews} ghim, ${villageNews} tin chung`,
  );

  // GH#314: every pooled story is real news, so it needs a publisher, an https link and the original date.
  const seededNews = await em.find(
    News,
    { id: { $in: NEWS.map((item) => demoEntityId('news', item.key)) } },
    { fields: ['id', 'title', 'sourceName', 'sourceUrl', 'sourcePublishedAt'] },
  );
  const noSource = seededNews.filter(
    (n) => !n.sourceName?.trim() || !n.sourceUrl?.startsWith('https://') || !n.sourcePublishedAt,
  );
  add(
    'Tin tức: mỗi tin trong dữ liệu có nguồn gốc (đơn vị đăng, liên kết https, ngày đăng gốc)',
    seededNews.length === NEWS.length && noSource.length === 0,
    noSource.length === 0
      ? `${seededNews.length} tin có nguồn`
      : `${noSource.length}/${NEWS.length} tin thiếu nguồn: ${noSource
          .slice(0, 3)
          .map((n) => n.title)
          .join('; ')}`,
  );
  if (options.media ?? true) {
    const newsCoverLinks = await em.find(
      MediaLink,
      { targetType: 'NEWS', role: 'COVER' },
      { fields: ['id', 'targetId', 'altText', 'altEn'] },
    );
    const badNewsAlt = newsCoverLinks.filter((l) => !l.altText?.trim() || !l.altEn?.trim());
    const coveredNews = new Set(newsCoverLinks.map((l) => l.targetId));
    // A story only needs a cover when the photo manifest has a licensed photo of its subject (GH#333); the others
    // show the site illustration.
    const expectedCoverIds = new Set(
      DEMO_PHOTO_LINKS.filter((l) => l.target === 'NEWS' && l.role === 'COVER').map((l) =>
        demoEntityId('news', l.key),
      ),
    );
    const uncoveredNews = seededNews.filter(
      (n) => expectedCoverIds.has(n.id) && !coveredNews.has(n.id),
    );
    add(
      'Tin tức: mỗi ảnh bìa có mô tả tiếng Việt và tiếng Anh, và mỗi tin có ảnh trong bảng ánh xạ đều có ảnh bìa',
      badNewsAlt.length === 0 && uncoveredNews.length === 0,
      badNewsAlt.length === 0 && uncoveredNews.length === 0
        ? `${newsCoverLinks.length} ảnh bìa đủ alt vi/en`
        : `${badNewsAlt.length} ảnh bìa thiếu alt vi/en, ${uncoveredNews.length} tin chưa có ảnh bìa; chạy pnpm demo:media`,
    );
  }

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

  await verifyProfileDepth(em, add, { media: options.media ?? true });
  await verifyEnglishProducts(em, add);

  if (options.media ?? true) await verifyMedia(em, add, entries, options.checkPublicUrls ?? false);

  return { ok: checks.every((c) => c.ok), checks };
}

/** Ảnh có giấy phép đã nối vào seed, ghi công đủ, giấy tờ mẫu của hộ chờ duyệt nằm ở bucket riêng tư. */
async function verifyMedia(
  em: EntityManager,
  add: (name: string, ok: boolean, detail: string) => void,
  entries: readonly JournalEntry[],
  checkPublicUrls: boolean,
): Promise<void> {
  const photoIds = new Map(DEMO_PHOTOS.map((p) => [demoPhotoAssetId(p.id), p]));
  const docIdsAll = new Set(DEMO_VERIFICATION_DOCS.map((d) => demoDocumentAssetId(d.id)));
  const photoAssets = await em.find(MediaAsset, { id: { $in: [...photoIds.keys()] } });
  const readyPhotos = photoAssets.filter(
    (a) =>
      a.status === 'READY' &&
      a.visibility === 'PUBLIC' &&
      a.ownerId === DEMO_PHOTO_OWNER_ID &&
      a.variants.length > 0,
  );
  add(
    `Ảnh minh hoạ: đủ ${DEMO_PHOTOS.length} tệp READY, có biến thể công khai`,
    readyPhotos.length === DEMO_PHOTOS.length,
    `${readyPhotos.length}/${DEMO_PHOTOS.length} tệp; chạy pnpm demo:media nếu thiếu`,
  );
  const noCredit = photoAssets.filter(
    (a) => !a.altText?.trim() || !a.credit?.sourceUrl.startsWith('https://'),
  );
  add(
    'Ảnh minh hoạ: mỗi tệp có nguồn và mô tả',
    photoAssets.length === DEMO_PHOTOS.length && noCredit.length === 0,
    noCredit.length === 0
      ? `${photoAssets.length} tệp đủ ghi công`
      : `thiếu ở ${noCredit.length} tệp`,
  );

  const links = await em.find(MediaLink, { targetType: { $ne: 'HOUSEHOLD' } });
  const householdLinks = await em.find(MediaLink, { targetType: 'HOUSEHOLD' });
  const linkKey = (
    l: Pick<MediaLink, 'targetType' | 'targetId' | 'role' | 'position'> & { mediaId: string },
  ) => `${l.targetType}|${l.targetId}|${l.role}|${l.position}|${l.mediaId}`;
  const present = new Set(
    [...links, ...householdLinks].map((l) => linkKey({ ...l, mediaId: l.media.id })),
  );
  const resolve = await loadTargetResolver(em).catch(() => null);
  const missing: string[] = [];
  if (!resolve) missing.push('hộ/sản phẩm/tin trong bảng ánh xạ không còn');
  else {
    for (const link of DEMO_PHOTO_LINKS) {
      const expected = linkKey({
        targetType: link.target,
        targetId: resolve(link.target, link.key),
        role: link.role,
        position: link.position,
        mediaId: demoPhotoAssetId(link.photo),
      });
      if (!present.has(expected)) missing.push(`${link.target}:${link.key}:${link.role}`);
    }
  }
  const countBy = (target: string) => DEMO_PHOTO_LINKS.filter((l) => l.target === target).length;
  add(
    'Ảnh gắn vào sản phẩm, hộ và tin đúng bảng ánh xạ',
    missing.length === 0,
    missing.length === 0
      ? `${DEMO_PHOTO_LINKS.length} liên kết (${countBy('PRODUCT')} sản phẩm, ${countBy('HOUSEHOLD')} hộ, ${countBy('NEWS')} tin)`
      : `thiếu ${missing.length}: ${missing.slice(0, 3).join(', ')}`,
  );

  const coverLinks = DEMO_PHOTO_LINKS.filter(
    (l) =>
      (l.target === 'PRODUCT' && l.role === 'COVER') ||
      (l.target === 'HOUSEHOLD' && l.role === 'BANNER'),
  );
  const badCovers: string[] = [];
  for (const link of coverLinks) {
    const row =
      link.target === 'PRODUCT'
        ? await em.findOne(Product, { traceCode: link.key }, { fields: ['coverUrl'] })
        : await em.findOne(Household, { slug: link.key }, { fields: ['coverUrl'] });
    if (!row?.coverUrl?.startsWith('http')) badCovers.push(link.key);
  }
  add(
    'Ảnh bìa mà API công khai trả (coverUrl) trỏ về bucket Storage',
    badCovers.length === 0,
    badCovers.length === 0
      ? `${coverLinks.length} ảnh bìa (sản phẩm và hộ)`
      : `chưa trỏ về bucket: ${badCovers.join(', ')}`,
  );

  const withImage = entries.filter((e) => e.images.length > 0);
  add(
    'Mốc nhật ký: không gắn ảnh chung của công đoạn vào món đồ (chuỗi băm không có ảnh)',
    entries.length > 0 && withImage.length === 0,
    withImage.length === 0
      ? `${entries.length} mốc không có ảnh`
      : `${withImage.length} mốc còn ảnh; chạy pnpm demo:media`,
  );

  const retiredIds = RETIRED_DEMO_PHOTO_IDS.map(demoPhotoAssetId);
  const retiredAssets = await em.count(MediaAsset, { id: { $in: retiredIds } });
  const retiredLinks = await em.count(MediaLink, { media: { $in: retiredIds } });
  add(
    'Ảnh đã gỡ khỏi dữ liệu mẫu không còn tệp hay liên kết nào',
    retiredAssets === 0 && retiredLinks === 0,
    retiredAssets === 0 && retiredLinks === 0
      ? `${RETIRED_DEMO_PHOTO_IDS.length} ảnh đã gỡ`
      : `còn ${retiredAssets} tệp và ${retiredLinks} liên kết; chạy pnpm demo:media`,
  );

  const noAltEn = [...links, ...householdLinks].filter((l) =>
    photoIds.has(l.media.id) || docIdsAll.has(l.media.id) ? !l.altEn?.trim() : false,
  );
  add(
    'Mỗi liên kết ảnh của dữ liệu mẫu có mô tả tiếng Anh (alt_en)',
    noAltEn.length === 0,
    noAltEn.length === 0 ? 'đủ mô tả tiếng Anh' : `thiếu alt_en ở ${noAltEn.length} liên kết`,
  );

  const docIds = new Map(DEMO_VERIFICATION_DOCS.map((d) => [demoDocumentAssetId(d.id), d]));
  const docAssets = await em.find(MediaAsset, { id: { $in: [...docIds.keys()] } });
  const goodDocs = docAssets.filter(
    (a) =>
      a.purpose === 'CERTIFICATE' &&
      a.visibility === 'PRIVATE' &&
      a.status === 'READY' &&
      a.ownerId === DEMO_DOCUMENT_OWNER_ID &&
      a.originalKey.startsWith(`originals/${DEMO_DOCUMENT_OWNER_ID}/`) &&
      a.variants.length === 0,
  );
  const docLinks = householdLinks.filter(
    (l) => l.targetId === DEMO_HOUSEHOLD_IDS.pending && l.role === 'DOCUMENT',
  );
  add(
    `Hộ chờ duyệt: ${DEMO_VERIFICATION_DOCS.length} giấy tờ mẫu ở bucket riêng tư, đã gắn vào hồ sơ`,
    goodDocs.length === DEMO_VERIFICATION_DOCS.length &&
      docLinks.length === DEMO_VERIFICATION_DOCS.length &&
      docLinks.every((l) => docIds.has(l.media.id)),
    `${goodDocs.length} tệp riêng tư, ${docLinks.length} liên kết`,
  );

  if (checkPublicUrls) {
    // Display variants of every photo (keys) plus the covers the public API returns (full URLs). The bucket's base URL
    // is taken from a cover, since journal entries no longer carry a photo to read it from.
    const keys = new Set<string>();
    for (const asset of readyPhotos) {
      const variant = pickDisplayVariant(asset.variants);
      if (variant) keys.add(variant.key);
    }
    const covers = [
      ...(await em.find(Product, { coverUrl: { $ne: null } }, { fields: ['coverUrl'] })).map(
        (p) => p.coverUrl as string,
      ),
      ...(await em.find(Household, { coverUrl: { $ne: null } }, { fields: ['coverUrl'] })).map(
        (h) => h.coverUrl as string,
      ),
    ].filter((u) => u.startsWith('http'));
    const base = covers[0]?.replace(/\/v\/.*$/, '');
    const targets = new Set<string>(covers);
    for (const key of keys) if (base) targets.add(`${base}/${key}`);
    const broken: string[] = [];
    for (const url of targets) {
      // GET, not HEAD: Supabase Storage answers HEAD with wrong headers.
      const ok = await fetch(url).then(
        async (r) => {
          await r.body?.cancel();
          return r.ok && (r.headers.get('content-type') ?? '').startsWith('image/');
        },
        () => false,
      );
      if (!ok) broken.push(url);
    }
    add(
      'Ảnh công khai mở được qua URL bucket (GET, đúng loại ảnh)',
      targets.size > 0 && broken.length === 0,
      broken.length === 0 ? `${targets.size} URL` : `${broken.length} URL lỗi, vd. ${broken[0]}`,
    );
  }
}
