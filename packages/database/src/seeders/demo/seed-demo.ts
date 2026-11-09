import type { EntityManager } from '@mikro-orm/core';
import {
  type AllocationStatus,
  assembleCooperativeQuotation,
  type BidStatus,
  CONSENT_PURPOSES,
  checkNewEntry,
  type DeliveryTerms,
  JOURNAL_STAGES,
  type JournalStage,
  PRIVACY_POLICY_VERSION,
  type ProductCategory,
  type RfqStatus,
  sealChain,
  skippedStagesFor,
  villageToday,
} from '@vcraft/domain';
import { slugify } from '@vcraft/utils';
import { v5 as uuidv5 } from 'uuid';
import { createFieldCipher, FIELD_CONTEXTS, type FieldCipher } from '../../crypto/field-cipher.js';
import {
  AppUser,
  Artisan,
  AuditLog,
  ConsentRecord,
  ContributionOffer,
  CooperativeQuotation,
  Household,
  JournalEntry,
  News,
  OrderAllocation,
  Product,
  ProductMaker,
  QuotationRequest,
  Workshop,
} from '../../entities/index.js';
import {
  DEMO_ACCOUNTS,
  DEMO_HOUSEHOLD_IDS,
  DEMO_QR_TRACE_CODE,
  DEMO_REQUEST_IDS,
} from './accounts.js';
import { artisanBio, householdStory } from './demo-text.js';
import { newsSeedFields } from './news-seed.js';
import {
  ARTISAN_FIRST,
  ARTISAN_LAST,
  CONTRIBUTIONS,
  CRAFT_ROLES,
  GLAZES,
  HOUSEHOLDS,
  type HouseholdSeed,
  NEWS,
  PENDING_HOUSEHOLD,
  PRODUCT_TEMPLATES,
  SKIP_REASONS,
  STAGE_NOTES,
  TEMPLATE_CATEGORY,
  VILLAGE_PARTS,
} from './pools.js';

/**
 * Dữ liệu mẫu cho buổi bảo vệ (GH#14, vCRAFT-83g mục demo). Viết bằng entity (không SQL tay) nên chạy y hệt
 * trên PostgreSQL và MySQL.
 *
 * "Đóng băng": mọi id là UUID v5 xác định, mọi ngày của hộ/sản phẩm/nhật ký cách một mốc cố định
 * ({@link FROZEN_ANCHOR}), bộ sinh số giả ngẫu nhiên có hạt cố định ⇒ chạy lại cho đúng cùng dữ liệu.
 * NGOẠI LỆ có chủ ý (phải còn hạn khi thi): mọi mốc thời gian của yêu cầu báo giá, chào giá, đề xuất
 * tham gia (`biddingClosesAt`, `requiredBy`, `completionDate`, `createdAt` của chúng) tính theo `now` lúc nạp.
 * Nên reset ngay trước buổi thi (xem docs/demo/README.md).
 */

export const FROZEN_ANCHOR = new Date('2026-09-01T03:00:00.000Z');
/** Six monthly price notices, newest first (index = months ago). VND, sample figures. */
const MATERIAL_PRICE_MONTHS = [
  { clay: 1_250_000, glaze: 185_000, gas: 470_000 },
  { clay: 1_220_000, glaze: 182_000, gas: 455_000 },
  { clay: 1_220_000, glaze: 178_000, gas: 462_000 },
  { clay: 1_180_000, glaze: 176_000, gas: 448_000 },
  { clay: 1_150_000, glaze: 176_000, gas: 430_000 },
  { clay: 1_150_000, glaze: 172_000, gas: 438_000 },
] as const;

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;
const NAMESPACE = '6f5c3d8e-2b1a-4c7d-9e0f-1a2b3c4d5e6f';
const TRACE_ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
/** Bốn hộ khớp dữ liệu triển lãm dựng sẵn: thêm năm thành lập, dòng thời gian, chứng nhận thật của bản mẫu. */
const HOUSEHOLD_SHOWCASE: Record<string, Partial<Household>> = {
  'Gốm Minh Hải': {
    foundedYear: 1962,
    generations: 5,
    timeline: [
      {
        year: 1962,
        title: 'Đỏ lửa lò bầu',
        text: 'Cụ Nguyễn Văn Sinh dựng lò bầu đầu tiên bên bến sông.',
      },
      {
        year: 2019,
        title: 'Nghệ nhân ưu tú',
        text: 'Anh Minh Hải được phong tặng danh hiệu Nghệ nhân ưu tú.',
      },
    ],
    certifications: [
      { name: 'Nghệ nhân ưu tú', issuer: 'Chủ tịch nước', year: 2019, verified: true },
      { name: 'OCOP 4 sao', issuer: 'UBND TP. Hà Nội', year: 2023, verified: true },
      { name: 'Giải Bàn tay vàng', issuer: 'Hiệp hội Làng nghề', year: 2024, verified: false },
    ],
  },
  'Gốm Lam Ngọc': {
    foundedYear: 1978,
    generations: 3,
    timeline: [
      { year: 1978, title: 'Mở xưởng', text: 'Hộ bắt đầu thử nghiệm men ngọc và men rạn.' },
    ],
    certifications: [{ name: 'OCOP 3 sao', issuer: 'UBND TP. Hà Nội', year: 2022, verified: true }],
  },
};

/** Ảnh bìa có giấy phép đã nằm trong `apps/web/public/images/demo` (xem `photo-credits.ts` của web). */
const HOUSEHOLD_COVERS: Record<string, string> = {
  'Gốm Lam Ngọc': '/images/demo/bia-lam-ngoc-1280.webp',
  'Lò Đức Phát': '/images/demo/bia-duc-phat-1280.webp',
  'Gốm Hạnh Thủy': '/images/demo/bia-hanh-thuy-1280.webp',
};
/** Sản phẩm cố định khớp ảnh có giấy phép; mô tả ảnh đúng điều nhìn thấy trong ảnh. */
interface FixedProduct {
  name: string;
  code: string;
  batch?: number;
  category: ProductCategory;
  priceVnd: number;
  stock: number;
  material: string;
  dimensions: string;
  weightGrams: number;
  /** Only products with a matching Commons photo have a cover; the rest show a preset illustration. */
  coverUrl?: string;
  coverAlt?: string;
  coverAltEn?: string;
}

const WORKSHOP_NAME_BY_PURPOSE = {
  SHOWROOM: 'Phòng trưng bày',
  BOTH: 'Xưởng vẽ',
  PRODUCTION: 'Lò nung',
} as const;
const PRODUCTS_PER_HOUSEHOLD = 11;
/** Khớp `visitingInfo` của phòng trưng bày mẫu: 8:00 – 17:00 hằng ngày. */
const SHOWROOM_HOURS = [0, 1, 2, 3, 4, 5, 6].map((day) => ({ day, open: '08:00', close: '17:00' }));
/** Ngày (tính từ mốc đầu) của từng công đoạn khi ghi đủ bảy công đoạn. */
const STAGE_OFFSET_DAYS = [0, 2, 7, 10, 13, 16, 18];

export interface DemoSeedOptions {
  /** Seals the sample citizen ID numbers. Default: built from `FIELD_ENCRYPTION_KEYS` (required to seed). */
  cipher?: FieldCipher;
  /** Thời điểm nạp, dùng cho mốc thời gian tương đối của yêu cầu báo giá. Mặc định `new Date()`. */
  now?: Date;
}

export interface DemoSeedSummary {
  users: number;
  households: number;
  pendingHouseholds: number;
  artisans: number;
  workshops: number;
  products: number;
  publishedProducts: number;
  journalEntries: number;
  requests: number;
  contributions: number;
  quotations: number;
  allocations: number;
  news: number;
}

/** UUID v5 xác định của một dòng dữ liệu mẫu; dùng chung với bước gắn ảnh (`link-media.ts`) để tìm lại đúng dòng. */
export const demoEntityId = (kind: string, key: string | number) =>
  uuidv5(`${kind}:${key}`, NAMESPACE);
const idOf = demoEntityId;

/** Index of the household represented by the demo `household` account (Lò Đức Phát). */
const DEMO_H = 2; // chỉ số hộ do tài khoản household đại diện (Lò Đức Phát)

/** Seed households: the approved ones (index 0..N-1) followed by the pending one (index N). */
export const DEMO_HOUSEHOLD_COUNT = HOUSEHOLDS.length + 1;

/** Fixed id of the demo household at `index` (the pending one is the last index, see {@link DEMO_HOUSEHOLD_COUNT}). */
export function demoHouseholdId(index: number): string {
  if (index === HOUSEHOLDS.length) return DEMO_HOUSEHOLD_IDS.pending;
  if (index === DEMO_H) return DEMO_HOUSEHOLD_IDS.household;
  return idOf('household', index);
}

/** Obviously fake citizen ID number of the demo household at `index`: eight zeros, then the household number. */
export const demoHouseholdIdNumber = (index: number): string =>
  `00000000${String(index).padStart(4, '0')}`;

/** mulberry32: bộ sinh giả ngẫu nhiên nhỏ, cùng hạt cho cùng chuỗi số. */
function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min: number, max: number) => min + Math.floor(next() * (max - min + 1)),
    pick: <T>(items: readonly T[]): T => items[Math.floor(next() * items.length)] as T,
  };
}

const isoDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);

function chooseStages(random: ReturnType<typeof rng>, count: number, inProgress: boolean) {
  let removals = JOURNAL_STAGES.length - count;
  const removed = new Set<number>();
  if (inProgress) {
    removed.add(JOURNAL_STAGES.length - 1); // chưa có mốc "finish"
    removals -= 1;
  }
  const removable = [0, 2, 3, 4]; // clay, dry, paint, glaze có thể bỏ; throw, fire, finish luôn có
  for (let i = removable.length - 1; i > 0; i--) {
    const j = random.int(0, i);
    [removable[i], removable[j]] = [removable[j] as number, removable[i] as number];
  }
  for (const index of removable.slice(0, Math.max(0, removals))) removed.add(index);
  return JOURNAL_STAGES.filter((_, index) => !removed.has(index));
}

interface QuotationSpec {
  status: BidStatus;
  parts: Array<{ h: number; qty: number }>;
  additionalChargeVnd: number;
  deliveryTerms: DeliveryTerms;
}

interface AllocationSpec {
  h: number;
  qty: number;
  status: AllocationStatus;
  completed: number;
}

interface RequestSpec {
  key: keyof typeof DEMO_REQUEST_IDS;
  design: string;
  quantity: number;
  unit: string;
  destination: string;
  status: RfqStatus;
  closesInDays: number;
  requiredInDays: number;
  invited: number[];
  optIn: boolean;
  coordinated: boolean;
  offers: Array<{ h: number; max: number; price: number }>;
  quotations?: QuotationSpec[];
  allocations?: AllocationSpec[];
}

/** 12 yêu cầu trải đủ 8 trạng thái RFQ. Chỉ số `h` là vị trí trong HOUSEHOLDS. */
const REQUESTS: readonly RequestSpec[] = [
  {
    key: 'draft',
    design: 'Cốc men trắng quai tròn in logo, quà tặng hội nghị',
    quantity: 800,
    unit: 'cái',
    destination: 'Trung tâm hội nghị, Hà Nội',
    status: 'DRAFT',
    closesInDays: 30,
    requiredInDays: 75,
    invited: [0, 2],
    optIn: true,
    coordinated: false,
    offers: [],
  },
  {
    key: 'expired',
    design: 'Bát vẽ sen men trong cho nhà hàng',
    quantity: 400,
    unit: 'cái',
    destination: 'Nhà hàng Sen Việt, Hà Nội',
    status: 'EXPIRED',
    closesInDays: -20,
    requiredInDays: 20,
    invited: [3, 5, 6],
    optIn: false,
    coordinated: false,
    offers: [],
  },
  {
    key: 'sentPlain',
    design: 'Ấm trà men ngọc, quà tặng đối tác',
    quantity: 300,
    unit: 'bộ',
    destination: 'Công ty Thảo Nguyên, Hải Phòng',
    status: 'SENT',
    closesInDays: 30,
    requiredInDays: 75,
    invited: [1, 2, 4, 5, 6],
    optIn: false,
    coordinated: false,
    offers: [],
  },
  {
    key: 'sentOptIn',
    design: 'Lọ hoa miệng loe trang trí sảnh khách sạn',
    quantity: 1000,
    unit: 'cái',
    destination: 'Khách sạn Hồ Tây, Hà Nội',
    status: 'SENT',
    closesInDays: 30,
    requiredInDays: 75,
    invited: [],
    optIn: true,
    coordinated: false,
    offers: [],
  },
  {
    key: 'sentCoordinated',
    design: 'Đĩa trà men rạn cho chuỗi quán trà',
    quantity: 2000,
    unit: 'cái',
    destination: 'Kho chuỗi Trà Sen, Bắc Ninh',
    status: 'SENT',
    closesInDays: 30,
    requiredInDays: 75,
    invited: [0, 1, DEMO_H, 3, 7, 8],
    optIn: true,
    coordinated: true,
    // Hộ DEMO_H được mời nhưng chưa đề xuất: để hộ đề xuất trực tiếp khi demo.
    offers: [
      { h: 0, max: 900, price: 31_000 },
      { h: 1, max: 700, price: 33_000 },
      { h: 7, max: 800, price: 30_500 },
      { h: 8, max: 600, price: 29_000 },
    ],
  },
  {
    key: 'biddingToAccept',
    design: 'Cốc men trắng quai tròn in logo, đợt 1 Công ty Thảo Nguyên',
    quantity: 2400,
    unit: 'cái',
    destination: 'Kho Công ty Thảo Nguyên, Hải Phòng',
    status: 'BIDDING',
    closesInDays: 30,
    requiredInDays: 75,
    invited: [0, 1, DEMO_H, 3, 9],
    optIn: true,
    coordinated: true,
    offers: [
      { h: 0, max: 800, price: 38_000 },
      { h: 1, max: 600, price: 41_000 },
      { h: DEMO_H, max: 700, price: 36_000 },
      { h: 3, max: 500, price: 44_000 },
      { h: 9, max: 400, price: 40_000 },
    ],
    quotations: [
      {
        status: 'SUBMITTED',
        parts: [
          { h: 0, qty: 800 },
          { h: 1, qty: 600 },
          { h: DEMO_H, qty: 600 },
          { h: 3, qty: 400 },
        ],
        additionalChargeVnd: 2_400_000,
        deliveryTerms: 'SEPARATE',
      },
    ],
  },
  {
    key: 'biddingReplaced',
    design: 'Tô sứ men trắng cho quán phở',
    quantity: 600,
    unit: 'cái',
    destination: 'Phở Gia Truyền, Hà Nội',
    status: 'BIDDING',
    closesInDays: 30,
    requiredInDays: 75,
    invited: [4, 5, 6],
    optIn: true,
    coordinated: true,
    offers: [
      { h: 4, max: 400, price: 52_000 },
      { h: 5, max: 350, price: 50_000 },
      { h: 6, max: 300, price: 55_000 },
    ],
    quotations: [
      {
        status: 'WITHDRAWN',
        parts: [
          { h: 4, qty: 400 },
          { h: 6, qty: 200 },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
      {
        status: 'SUBMITTED',
        parts: [
          { h: 4, qty: 350 },
          { h: 5, qty: 250 },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    ],
  },
  {
    key: 'acceptedConfirm',
    design: 'Bình ngâm rượu men nâu, quà Tết',
    quantity: 500,
    unit: 'cái',
    destination: 'Công ty Thảo Nguyên, Hải Phòng',
    status: 'ACCEPTED',
    closesInDays: -5,
    requiredInDays: 40,
    invited: [DEMO_H, 4, 5, 12],
    optIn: true,
    coordinated: true,
    offers: [
      { h: DEMO_H, max: 200, price: 210_000 },
      { h: 4, max: 200, price: 205_000 },
      { h: 5, max: 150, price: 215_000 },
      { h: 12, max: 150, price: 200_000 },
    ],
    quotations: [
      {
        status: 'ACCEPTED',
        parts: [
          { h: DEMO_H, qty: 150 },
          { h: 4, qty: 150 },
          { h: 5, qty: 100 },
          { h: 12, qty: 100 },
        ],
        additionalChargeVnd: 1_800_000,
        deliveryTerms: 'SEPARATE',
      },
    ],
    allocations: [
      { h: DEMO_H, qty: 150, status: 'PROPOSED', completed: 0 },
      { h: 4, qty: 150, status: 'CONFIRMED', completed: 0 },
      { h: 5, qty: 100, status: 'CONFIRMED', completed: 0 },
      { h: 12, qty: 100, status: 'CONFIRMED', completed: 0 },
    ],
  },
  {
    key: 'acceptedFresh',
    design: 'Khay trà gốm, quà tặng khách VIP',
    quantity: 240,
    unit: 'cái',
    destination: 'Showroom Hà Nội',
    status: 'ACCEPTED',
    closesInDays: -5,
    requiredInDays: 40,
    invited: [10, 11],
    optIn: true,
    coordinated: true,
    offers: [
      { h: 10, max: 150, price: 180_000 },
      { h: 11, max: 150, price: 185_000 },
    ],
    quotations: [
      {
        status: 'ACCEPTED',
        parts: [
          { h: 10, qty: 120 },
          { h: 11, qty: 120 },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    ],
    allocations: [
      { h: 10, qty: 120, status: 'PROPOSED', completed: 0 },
      { h: 11, qty: 120, status: 'PROPOSED', completed: 0 },
    ],
  },
  {
    key: 'inProduction',
    design: 'Cốc men trắng quai tròn in logo, đơn chia 4 hộ đang sản xuất',
    quantity: 2000,
    unit: 'cái',
    destination: 'Kho Công ty Thảo Nguyên, Hải Phòng',
    status: 'IN_PRODUCTION',
    closesInDays: -12,
    requiredInDays: 33,
    invited: [0, 1, DEMO_H, 3],
    optIn: true,
    coordinated: true,
    offers: [
      { h: 0, max: 700, price: 38_000 },
      { h: 1, max: 600, price: 41_000 },
      { h: DEMO_H, max: 600, price: 36_000 },
      { h: 3, max: 400, price: 44_000 },
    ],
    quotations: [
      {
        status: 'ACCEPTED',
        parts: [
          { h: 0, qty: 600 },
          { h: 1, qty: 500 },
          { h: 3, qty: 400 },
          { h: DEMO_H, qty: 500 },
        ],
        additionalChargeVnd: 2_000_000,
        deliveryTerms: 'SEPARATE',
      },
    ],
    // Ba hộ đã xong; hộ household còn thiếu 150 cái: báo đủ 500 là DONE và Buyer nhận hàng được.
    allocations: [
      { h: 0, qty: 600, status: 'DONE', completed: 600 },
      { h: 1, qty: 500, status: 'DONE', completed: 500 },
      { h: 3, qty: 400, status: 'DONE', completed: 400 },
      { h: DEMO_H, qty: 500, status: 'IN_PROGRESS', completed: 350 },
    ],
  },
  {
    key: 'delivered',
    design: 'Chén tống men lam, quà tặng khách mời',
    quantity: 360,
    unit: 'cái',
    destination: 'Hội quán Bát Tràng, Hà Nội',
    status: 'DELIVERED',
    closesInDays: -40,
    requiredInDays: 5,
    invited: [13, 16],
    optIn: true,
    coordinated: true,
    offers: [
      { h: 13, max: 200, price: 60_000 },
      { h: 16, max: 200, price: 58_000 },
    ],
    quotations: [
      {
        status: 'ACCEPTED',
        parts: [
          { h: 13, qty: 200 },
          { h: 16, qty: 160 },
        ],
        additionalChargeVnd: 0,
        deliveryTerms: 'INCLUDED',
      },
    ],
    allocations: [
      { h: 13, qty: 200, status: 'DONE', completed: 200 },
      { h: 16, qty: 160, status: 'DONE', completed: 160 },
    ],
  },
  {
    key: 'cancelled',
    design: 'Lục bình men hoa nâu',
    quantity: 150,
    unit: 'cái',
    destination: 'Khách sạn Hồ Tây, Hà Nội',
    status: 'CANCELLED',
    closesInDays: 20,
    requiredInDays: 60,
    invited: [14, 15],
    optIn: false,
    coordinated: false,
    offers: [],
  },
];

function fullName(random: ReturnType<typeof rng>): string {
  return `${random.pick(ARTISAN_LAST)} ${random.pick(['Văn', 'Thị', 'Minh', 'Quốc', 'Ngọc'])} ${random.pick(ARTISAN_FIRST)}`;
}

/**
 * Nạp dữ liệu mẫu vào CSDL trống (chưa có tài khoản demo). Không xóa gì: muốn nạp lại từ đầu dùng
 * `resetDemoData` (chỉ qua `pnpm demo:reset` có cổng chặn). Một lần `flush`, nên lỗi giữa chừng không để lại dữ liệu dở.
 */
export async function seedDemoData(
  em: EntityManager,
  options: DemoSeedOptions = {},
): Promise<DemoSeedSummary> {
  if ((await em.count(AppUser, { id: DEMO_ACCOUNTS.admin.id })) > 0) {
    throw new Error(
      'Dữ liệu demo đã tồn tại; chạy `pnpm demo:reset` (APP_ENV=demo) để nạp lại từ đầu.',
    );
  }
  const cipher = options.cipher ?? createFieldCipher(process.env);
  const now = new Date(Math.floor((options.now ?? new Date()).getTime() / 1000) * 1000);
  const random = rng(20261101);
  const summary: DemoSeedSummary = {
    users: 0,
    households: 0,
    pendingHouseholds: 0,
    artisans: 0,
    workshops: 0,
    products: 0,
    publishedProducts: 0,
    journalEntries: 0,
    requests: 0,
    contributions: 0,
    quotations: 0,
    allocations: 0,
    news: 0,
  };

  // --- Tài khoản cố định ---
  const accounts = new Map<string, AppUser>();
  for (const [index, account] of Object.values(DEMO_ACCOUNTS).entries()) {
    const user = em.create(AppUser, {
      id: account.id,
      email: account.email,
      username: account.username,
      fullName: account.fullName,
      role: account.role,
      status: 'ACTIVE',
      createdAt: new Date(FROZEN_ANCHOR.getTime() - 300 * DAY + index * HOUR),
      updatedAt: new Date(FROZEN_ANCHOR.getTime() - 300 * DAY + index * HOUR),
    });
    accounts.set(account.key, user);
    summary.users++;
  }
  const buyer = accounts.get('buyer') as AppUser;
  // Sample accounts count as having ticked every consent box, so the demo can use every flow (NFR-SEC-07).
  for (const account of Object.values(DEMO_ACCOUNTS)) {
    if (account.role === 'ADMIN') continue;
    for (const purpose of CONSENT_PURPOSES) {
      em.create(ConsentRecord, {
        userId: account.id,
        purpose,
        policyVersion: PRIVACY_POLICY_VERSION,
        createdAt: new Date(FROZEN_ANCHOR.getTime() - 299 * DAY),
        updatedAt: new Date(FROZEN_ANCHOR.getTime() - 299 * DAY),
      });
    }
  }

  // --- Mã truy xuất duy nhất, đúng bảng chữ của API (trace-code.ts) ---
  const usedCodes = new Set<string>(['BT7K2QXM', 'HX2M9KQD', DEMO_QR_TRACE_CODE]);
  const newTraceCode = () => {
    for (;;) {
      let code = '';
      for (let i = 0; i < 8; i++) code += TRACE_ALPHABET[random.int(0, TRACE_ALPHABET.length - 1)];
      if (!usedCodes.has(code)) {
        usedCodes.add(code);
        return code;
      }
    }
  };
  /** Sản phẩm cố định khớp dữ liệu minh họa của apps/web: {chỉ số hộ, chỉ số món} → tên, mã. */
  const fixedProducts = new Map<string, FixedProduct>([
    [
      '0:0',
      {
        name: 'Bình hút lộc men lam',
        code: 'BT7K2QXM',
        category: 'VASE',
        priceVnd: 4_800_000,
        stock: 1,
        material: 'Đất sét trắng Trúc Thôn, men lam xám tro',
        dimensions: 'Cao 32 cm · Miệng 9 cm · Bụng 22 cm',
        weightGrams: 2400,
        coverUrl: '/images/demo/binh-men-lam-xam-1280.webp',
        coverAlt:
          'Bình cổ cao, bụng tròn, men xám lam, đắp nổi cành cây và một người cầm cần câu nhuốm vàng',
        coverAltEn:
          'A tall-necked, round-bellied vase in grey-blue glaze with a relief branch and a gilded figure holding a fishing rod',
      },
    ],
    [
      '3:0',
      {
        name: 'Bát vẽ sen men trong',
        code: 'HX2M9KQD',
        category: 'TABLEWARE',
        priceVnd: 380_000,
        stock: 40,
        material: 'Đất sét trắng, men trong',
        dimensions: 'Đường kính 16 cm',
        weightGrams: 420,
      },
    ],
    [
      `${DEMO_H}:0`,
      {
        name: 'Cốc men trắng quai tròn',
        code: DEMO_QR_TRACE_CODE,
        batch: 300,
        category: 'TEA',
        priceVnd: 145_000,
        stock: 300,
        material: 'Đất sét, men trắng',
        dimensions: '330 ml',
        weightGrams: 310,
      },
    ],
  ]);

  // --- Hộ, nghệ nhân, xưởng, sản phẩm, nhật ký ---
  type HouseholdRow = { seed: HouseholdSeed; status: 'APPROVED' | 'PENDING_REVIEW'; index: number };
  const rows: HouseholdRow[] = [
    ...HOUSEHOLDS.map((seed, index) => ({ seed, status: 'APPROVED' as const, index })),
    { seed: PENDING_HOUSEHOLD, status: 'PENDING_REVIEW' as const, index: HOUSEHOLDS.length },
  ];
  const households: Household[] = [];

  for (const row of rows) {
    const pending = row.status === 'PENDING_REVIEW';
    const slug = slugify(row.seed.name);
    const createdMs = FROZEN_ANCHOR.getTime() - (240 - row.index * 3) * DAY;
    let representative: AppUser;
    if (row.index === DEMO_H && !pending) representative = accounts.get('household') as AppUser;
    else if (pending) representative = accounts.get('pending') as AppUser;
    else {
      representative = em.create(AppUser, {
        id: idOf('user', `rep-${row.index}`),
        email: `rep.${slug}@example.com`,
        // GH#212: a unique handle derived from the household slug, keeping the sample data consistent.
        username: slugify(`rep.${slug}`),
        fullName: row.seed.owner,
        role: 'HOUSEHOLD',
        status: 'ACTIVE',
        createdAt: new Date(createdMs),
        updatedAt: new Date(createdMs),
      });
      summary.users++;
    }
    const household = em.create(Household, {
      id: demoHouseholdId(row.index),
      name: row.seed.name,
      slug,
      // Filled in from `story` once the first workshop has its address (GH#204).
      history: '',
      village: 'Bát Tràng',
      craft: row.seed.craft,
      coverUrl: HOUSEHOLD_COVERS[row.seed.name] ?? null,
      foundedYear: 1940 + ((row.index * 7) % 60),
      generations: 2 + (row.index % 4),
      capacityByCategory: { VASE: 200 + row.index * 10, TABLEWARE: 500 + row.index * 20 },
      ...HOUSEHOLD_SHOWCASE[row.seed.name],
      status: row.status,
      statusReason: null,
      approvedAt: pending ? null : new Date(createdMs + 2 * DAY),
      // Obviously fake and encrypted like a real one.
      idNumberEnc: cipher.encrypt(
        demoHouseholdIdNumber(row.index),
        FIELD_CONTEXTS.householdIdNumber,
      ),
      representative,
      createdAt: new Date(createdMs),
      updatedAt: new Date(createdMs),
    });
    households.push(household);
    if (pending) summary.pendingHouseholds++;
    else {
      summary.households++;
      em.create(AuditLog, {
        id: idOf('audit', `approve-${row.index}`),
        actorId: DEMO_ACCOUNTS.admin.id,
        action: 'household.approve',
        entity: 'household',
        entityId: household.id,
        before: { status: 'PENDING_REVIEW' },
        after: { status: 'APPROVED', reason: null },
        createdAt: new Date(createdMs + 2 * DAY),
        updatedAt: new Date(createdMs + 2 * DAY),
      });
    }

    // Nghệ nhân: 2–3 người, người đầu là chủ hộ
    const artisans: Artisan[] = [];
    const artisanCount = random.int(2, 3);
    for (let a = 0; a < artisanCount; a++) {
      // Same call order as before, so the seeded random stream (and every frozen id) is unchanged.
      const artisanName = a === 0 ? row.seed.owner : fullName(random);
      const craftRole = a === 0 ? 'Chủ hộ, thợ cả' : random.pick(CRAFT_ROLES);
      artisans.push(
        em.create(Artisan, {
          id: idOf('artisan', `${row.index}-${a}`),
          household,
          name: artisanName,
          craftRole,
          bio: artisanBio({
            household: row.seed,
            artisanName,
            position: a,
            craftRole,
          }),
          createdAt: new Date(createdMs + a * HOUR),
          updatedAt: new Date(createdMs + a * HOUR),
        }),
      );
      summary.artisans++;
    }

    // Xưởng: 1–2, có tọa độ quanh Bát Tràng (20.9758, 105.9139)
    const workshopCount = random.int(1, 2);
    for (let w = 0; w < workshopCount; w++) {
      const purpose = w === 0 ? (random.next() < 0.5 ? 'BOTH' : 'SHOWROOM') : 'PRODUCTION';
      const workshop = em.create(Workshop, {
        id: idOf('workshop', `${row.index}-${w}`),
        household,
        name: `${WORKSHOP_NAME_BY_PURPOSE[purpose]} ${row.seed.name}`,
        address: `${random.pick(VILLAGE_PARTS)}, Bát Tràng, Gia Lâm, Hà Nội`,
        purpose,
        acceptsVisitors: purpose !== 'PRODUCTION',
        openingHours: purpose === 'PRODUCTION' ? null : SHOWROOM_HOURS,
        visitingInfo:
          purpose === 'PRODUCTION'
            ? null
            : 'Mở cửa 8:00 – 17:00 hằng ngày, nên báo trước qua điện thoại.',
        lat: (20.9758 + (random.next() - 0.5) * 0.012).toFixed(6),
        // Lệch về phía đông: phía tây Bát Tràng là sông Hồng.
        lng: (105.9139 + (random.next() - 0.1) * 0.009).toFixed(6),
        createdAt: new Date(createdMs + w * HOUR),
        updatedAt: new Date(createdMs + w * HOUR),
      });
      if (w === 0) {
        household.history = householdStory(row.seed, workshop.address);
      }
      summary.workshops++;
    }

    // Sản phẩm: hộ đã duyệt có 11 món (hộ household 9 món đã xuất bản + 2 nháp để demo xuất bản); hộ chờ duyệt 2 nháp
    const productCount = pending ? 2 : PRODUCTS_PER_HOUSEHOLD;
    for (let j = 0; j < productCount; j++) {
      const fixed = fixedProducts.get(`${row.index}:${j}`);
      const templateName = PRODUCT_TEMPLATES[(row.index * 7 + j * 3) % PRODUCT_TEMPLATES.length];
      const glaze = GLAZES[(row.index + j * 5) % GLAZES.length];
      const name = fixed?.name ?? `${templateName} ${glaze}`;
      // Giá và tồn kho tính từ chỉ số, không gọi `random`: thêm lượt gọi sẽ làm đổi mọi mã truy xuất đã đóng băng.
      const variant = (row.index * 13 + j * 29) % 24;
      const code = fixed?.code ?? newTraceCode();
      const productId = idOf('product', `${row.index}-${j}`);
      const draft = pending || (row.index === DEMO_H && j >= PRODUCTS_PER_HOUSEHOLD - 2);
      const batch = fixed?.batch ?? (random.next() < 0.25 ? random.int(2, 12) * 20 : undefined);

      // Nhật ký 4–7 mốc; hàng cố định luôn đủ 7 mốc, nháp của hộ household cũng đủ để xuất bản ngay
      const complete = fixed !== undefined || (draft && !pending);
      const roll = random.next();
      const count = complete ? 7 : roll < 0.35 ? 7 : roll < 0.6 ? 6 : roll < 0.8 ? 5 : 4;
      const inProgress = !complete && count < 7 && random.next() < 0.12;
      const stages = chooseStages(random, count, inProgress);
      const startMs = FROZEN_ANCHOR.getTime() - random.int(25, 150) * DAY;
      const contents: Array<{
        stage: JournalStage;
        at: string;
        note: string;
        mediaChecksums: string[];
        skipReason?: string;
      }> = [];
      for (const stage of stages) {
        const facts = contents.map((c, seq) => ({ seq, stage: c.stage }));
        const skipped = skippedStagesFor(facts, stage);
        const skipReason =
          skipped.length > 0
            ? skipped
                .map((s) => SKIP_REASONS[s])
                .join(' ')
                .slice(0, 300)
            : undefined;
        const checked = checkNewEntry(
          { entries: facts, published: false, frozen: false },
          { stage, skipReason },
        );
        if (!checked.ok) throw new Error(`Nhật ký mẫu vi phạm luật: ${checked.error.code}`);
        const notes = STAGE_NOTES[stage];
        contents.push({
          stage,
          at: isoDate(startMs + (STAGE_OFFSET_DAYS[JOURNAL_STAGES.indexOf(stage)] ?? 0) * DAY),
          note: notes[(row.index + j + contents.length) % notes.length] as string,
          mediaChecksums: [],
          ...(skipReason !== undefined && { skipReason }),
        });
      }
      const lastMs = Date.parse(`${contents.at(-1)?.at}T00:00:00.000Z`);

      const product = em.create(Product, {
        id: productId,
        household,
        name,
        slug: `${slugify(name) || 'san-pham'}-${code.toLowerCase()}`,
        traceCode: code,
        description: `${name} do hộ ${row.seed.name} làm thủ công tại Bát Tràng.`,
        kind: batch === undefined ? 'OBJECT' : 'BATCH',
        batchSize: batch ?? null,
        category:
          fixed?.category ?? TEMPLATE_CATEGORY[templateName as keyof typeof TEMPLATE_CATEGORY],
        priceVnd: fixed?.priceVnd ?? (variant + 2) * 50_000,
        stock: fixed?.stock ?? batch ?? (variant % 5 === 0 ? 0 : 1),
        material: fixed?.material ?? `Đất sét Bát Tràng, ${glaze}`,
        dimensions: fixed?.dimensions ?? null,
        weightGrams: fixed?.weightGrams ?? 300 + variant * 40,
        coverUrl: fixed?.coverUrl ?? null,
        coverAlt: fixed?.coverAlt ?? null,
        coverAltEn: fixed?.coverAltEn ?? null,
        status: draft ? 'DRAFT' : 'PUBLISHED',
        publishedAt: draft ? null : new Date(lastMs + DAY + 8 * HOUR),
        withdrawnReason: null,
        createdAt: new Date(startMs + 3 * HOUR),
        updatedAt: new Date(startMs + 3 * HOUR),
      });
      summary.products++;
      if (!draft) summary.publishedProducts++;

      // Ghi công 1–2 nghệ nhân
      const makerCount = Math.min(artisans.length, random.int(1, 2));
      for (let m = 0; m < makerCount; m++) {
        em.create(ProductMaker, {
          id: idOf('maker', `${row.index}-${j}-${m}`),
          product,
          artisan: artisans[(j + m) % artisans.length] as Artisan,
          contribution: CONTRIBUTIONS[(j + m * 2) % CONTRIBUTIONS.length] as string,
          position: m,
          createdAt: new Date(startMs + 4 * HOUR),
          updatedAt: new Date(startMs + 4 * HOUR),
        });
      }

      const sealed = await sealChain(productId, contents);
      for (const entry of sealed) {
        const at = Date.parse(`${entry.at}T09:00:00.000Z`);
        em.create(JournalEntry, {
          id: idOf('journal', `${productId}-${entry.seq}`),
          product,
          seq: entry.seq,
          stage: entry.stage as JournalStage,
          declaredDate: entry.at,
          note: entry.note,
          images: [],
          supersedes: null,
          skipReason: entry.skipReason ?? null,
          prevHash: entry.prevHash,
          hash: entry.hash,
          createdAt: new Date(at),
          updatedAt: new Date(at),
        });
        summary.journalEntries++;
      }
    }
  }

  // --- Tin tức: tin chung của làng và tin của hộ đã duyệt, mốc xuất bản cách mốc đóng băng ---
  for (const [order, item] of NEWS.entries()) {
    const owner = item.h === null ? null : (households[item.h] as Household);
    const ownerName = owner?.name ?? '';
    const fields = newsSeedFields(item, order, FROZEN_ANCHOR, ownerName);
    em.create(News, {
      ...fields,
      id: idOf('news', item.key),
      slug: slugify(fields.title),
      household: owner,
      status: 'PUBLISHED',
      createdAt: fields.publishedAt,
      updatedAt: fields.publishedAt,
    });
    summary.news++;
  }

  // --- Giá nguyên liệu 6 tháng và lịch cắt điện hôm nay (PLAN E11), theo `now` để biểu đồ và banner luôn có số ---
  const [thisYear, thisMonth] = villageToday(now).split('-').map(Number) as [number, number];
  for (const [monthsAgo, prices] of MATERIAL_PRICE_MONTHS.entries()) {
    // The 1st of each of the last six calendar months, published at 08:00 Hà Nội time (01:00 UTC).
    const index = thisYear * 12 + thisMonth - 1 - monthsAgo;
    const month = `${Math.floor(index / 12)}-${String((index % 12) + 1).padStart(2, '0')}`;
    const effectiveOn = `${month}-01`;
    const publishedAt = new Date(`${effectiveOn}T01:00:00.000Z`);
    em.create(News, {
      id: idOf('news', `material-prices-${monthsAgo}`),
      slug: `gia-nguyen-lieu-${month}`,
      title: `Giá nguyên liệu tháng ${Number(month.slice(5))}/${month.slice(0, 4)}`,
      summary: 'Bảng giá đất sét, men và gas Ban quản lý tổng hợp từ các đại lý trong làng.',
      body: 'Giá tham khảo tại các đại lý trong làng, áp dụng từ đầu tháng.',
      category: 'MATERIAL_PRICES',
      household: null,
      status: 'PUBLISHED',
      publishedAt,
      data: {
        materialPrices: {
          effectiveOn,
          prices: [
            { material: 'CLAY', unit: 'tấn', priceVnd: prices.clay },
            { material: 'GLAZE', unit: 'kg', priceVnd: prices.glaze },
            { material: 'GAS', unit: 'bình 12 kg', priceVnd: prices.gas },
          ],
        },
      },
      createdAt: publishedAt,
      updatedAt: publishedAt,
    });
    summary.news++;
  }
  {
    const publishedAt = new Date(now.getTime() - 2 * DAY);
    const today = villageToday(now);
    em.create(News, {
      id: idOf('news', 'power-schedule-today'),
      slug: 'lich-cat-dien-hom-nay',
      title: 'Lịch cắt điện trong làng',
      summary: 'Điện lực báo cắt điện để bảo trì đường dây; các hộ đốt lò điện nên dời mẻ nung.',
      body: 'Điện lực Gia Lâm báo cắt điện để bảo trì đường dây trung thế.',
      category: 'POWER_SCHEDULE',
      visibility: 'VILLAGE',
      household: null,
      status: 'PUBLISHED',
      publishedAt,
      data: {
        powerSchedule: {
          outages: [
            { date: today, from: '08:00', to: '11:30', area: 'Xóm 2, Xóm 3' },
            { date: today, from: '13:30', to: '16:00', area: 'Thôn Giang Cao' },
          ],
        },
      },
      createdAt: publishedAt,
      updatedAt: publishedAt,
    });
    summary.news++;
  }

  // --- Yêu cầu báo giá, đề xuất, chào giá, phân bổ (mốc thời gian tương đối theo `now`) ---
  for (const [order, spec] of REQUESTS.entries()) {
    const requestId = DEMO_REQUEST_IDS[spec.key];
    const biddingClosesAt = new Date(now.getTime() + spec.closesInDays * DAY);
    const requiredBy = new Date(now.getTime() + spec.requiredInDays * DAY);
    const createdAt = new Date(now.getTime() - (REQUESTS.length - order) * DAY);
    const request = em.create(QuotationRequest, {
      id: requestId,
      buyer,
      coordinatorId: spec.coordinated ? DEMO_ACCOUNTS.admin.id : null,
      revision: spec.offers.length + (spec.quotations?.length ?? 0),
      design: spec.design,
      quantity: spec.quantity,
      unit: spec.unit,
      destination: spec.destination,
      requiredBy,
      biddingClosesAt,
      invitedHouseholdIds: spec.invited.map((h) => (households[h] as Household).id),
      coordinationOptIn: spec.optIn,
      status: spec.status,
      createdAt,
      updatedAt: createdAt,
    });
    summary.requests++;

    const completionOf = (rank: number) => new Date(requiredBy.getTime() - (3 + rank * 2) * DAY);
    const offers = new Map<number, { entity: ContributionOffer; completionDate: Date }>();
    for (const [rank, offer] of spec.offers.entries()) {
      const completionDate = completionOf(rank);
      const entity = em.create(ContributionOffer, {
        id: idOf('offer', `${requestId}-${offer.h}`),
        request,
        household: households[offer.h] as Household,
        maxQuantity: offer.max,
        unitPriceVnd: offer.price,
        completionDate,
        status: 'ACTIVE',
        history: [],
        createdAt: new Date(createdAt.getTime() + (rank + 1) * HOUR),
        updatedAt: new Date(createdAt.getTime() + (rank + 1) * HOUR),
      });
      offers.set(offer.h, { entity, completionDate });
      summary.contributions++;
    }

    const quotationEntities: CooperativeQuotation[] = [];
    for (const [qIndex, quotationSpec] of (spec.quotations ?? []).entries()) {
      const assembled = assembleCooperativeQuotation({
        requiredQuantity: spec.quantity,
        biddingClosesAt,
        requiredBy,
        contributions: spec.offers.map((o) => ({
          householdId: (households[o.h] as Household).id,
          maxQuantity: o.max,
          unitPriceVnd: o.price,
          completionDate: (offers.get(o.h) as { completionDate: Date }).completionDate,
          version: 1,
        })),
        parts: quotationSpec.parts.map((part) => {
          const offer = spec.offers.find((o) => o.h === part.h) as RequestSpec['offers'][number];
          return {
            householdId: (households[part.h] as Household).id,
            quantity: part.qty,
            unitPriceVnd: offer.price,
            completionDate: (offers.get(part.h) as { completionDate: Date }).completionDate,
            contributionVersion: 1,
          };
        }),
        additionalChargeVnd: quotationSpec.additionalChargeVnd,
        deliveryTerms: quotationSpec.deliveryTerms,
      });
      if (!assembled.ok) {
        throw new Error(`Chào giá mẫu "${spec.key}" không hợp lệ: ${assembled.error.code}`);
      }
      const quotation = assembled.value;
      quotationEntities.push(
        em.create(CooperativeQuotation, {
          id: idOf('quotation', `${requestId}-${qIndex}`),
          request,
          status: quotationSpec.status,
          quantity: quotation.quantity,
          parts: quotation.parts.map((part) => ({
            ...part,
            completionDate: part.completionDate.toISOString(),
          })),
          productionTotalVnd: quotation.productionTotalVnd,
          additionalChargeVnd: quotation.additionalChargeVnd,
          totalVnd: quotation.totalVnd,
          deliveryTerms: quotation.deliveryTerms,
          bidType: 'COOPERATIVE',
          createdAt: new Date(createdAt.getTime() + (10 + qIndex) * HOUR),
          updatedAt: new Date(createdAt.getTime() + (10 + qIndex) * HOUR),
        }),
      );
      summary.quotations++;
    }

    if (spec.allocations) {
      const accepted = quotationEntities.find((q) => q.status === 'ACCEPTED');
      if (!accepted)
        throw new Error(`Yêu cầu "${spec.key}" có phân bổ nhưng không có chào giá đã chốt`);
      for (const [rank, allocation] of spec.allocations.entries()) {
        em.create(OrderAllocation, {
          id: idOf('allocation', `${requestId}-${allocation.h}`),
          quotation: accepted,
          household: households[allocation.h] as Household,
          quantity: allocation.qty,
          completedQty: allocation.completed,
          status: allocation.status,
          createdAt: new Date(createdAt.getTime() + (20 + rank) * HOUR),
          updatedAt: new Date(createdAt.getTime() + (20 + rank) * HOUR),
        });
        summary.allocations++;
      }
    }
  }

  await em.flush();
  return summary;
}
