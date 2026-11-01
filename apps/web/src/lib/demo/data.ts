/**
 * Dữ liệu minh họa cho các màn chính khi API chưa có (PLAN S0: "Figma 6 màn chính" dựng thẳng
 * bằng route thật). Hình dạng gần với DTO sẽ có trong `@vcraft/contracts`; khi endpoint sẵn sàng,
 * thay các hàm `get*` dưới đây bằng query của `@vcraft/api-client` và xóa file này.
 *
 * Tên hộ, nghệ nhân là hư cấu. Mọi mốc nhật ký và dấu băm trong file này cũng là dữ liệu minh họa;
 * dấu băm được tính thật bằng thuật toán BR-01 (xem `journal/hash-chain.ts` của `@vcraft/domain`) lúc dựng dữ liệu.
 */
import {
  type BidStatus,
  type BidType,
  type ChainEntry,
  type RfqStatus,
  sealChain,
  sha256Hex,
  type WorkshopPurpose,
} from '@vcraft/domain';

export interface Certification {
  name: string;
  issuer: string;
  year: number;
  verified: boolean;
}

export interface FamilyEvent {
  year: number;
  title: string;
  text: string;
}

/** Ảnh thật có giấy phép (xem `photo-credits.ts`): `id` khớp file trong /images/demo, `alt` mô tả đúng điều nhìn thấy. */
export interface DemoPhotoRef {
  id: string;
  /** Vietnamese description; shown only when there is no translation under `photoAlt.<altKey>`. */
  alt: string;
  /** Key in the `photoAlt` message namespace, so the alt text follows the interface language. */
  altKey?: string;
}

export interface GalleryShot {
  caption: string;
  /** Tỉ lệ khung (BRAND §5): xưởng 3:2, chân dung 3:4, chi tiết 1:1. */
  ratio: '3/2' | '3/4' | '1/1' | '4/5';
  /** Màu chủ đạo của ảnh (backend sinh `dominantColor`). */
  tint: string;
  /** Ảnh thật; không có thì dùng khung nhuốm màu `tint`. */
  photo?: DemoPhotoRef;
}

/** Người làm của hộ: được ghi công bằng tên riêng, không cần tài khoản (vCRAFT-9hg.2). */
export interface Maker {
  name: string;
  role: string;
}

/** Xưởng của hộ; phòng trưng bày đón khách được tách khỏi nơi sản xuất (vCRAFT-9hg.6). */
export interface DemoWorkshop {
  id: string;
  name: string;
  address: string;
  purpose: WorkshopPurpose;
  acceptsVisitors: boolean;
  visitingInfo?: string;
  /** Vị trí trên bản đồ thu nhỏ, % theo khung. */
  pin: { x: number; y: number };
}

/** Ghi công một người làm cho một sản phẩm, theo phần việc. */
export interface MakerCredit {
  name: string;
  contribution: string;
}

export interface Artisan {
  slug: string;
  household: string;
  artisanName: string;
  title: string;
  craft: string;
  foundedYear: number;
  generation: number;
  address: string;
  quote: string;
  story: string[];
  tint: string;
  /** Ảnh thẻ nghệ nhân (3:4). Không chụp mặt người thật: nghệ nhân là nhân vật mẫu, nên dùng ảnh bàn tay, góc xưởng. */
  portrait?: DemoPhotoRef;
  /** Ảnh bìa rộng (16:9) đầu trang hồ sơ hộ. */
  banner?: DemoPhotoRef;
  openNow: boolean;
  hours: string;
  capacityPerMonth: number;
  rating: number;
  completedOrders: number;
  /** Vị trí trên bản đồ thu nhỏ, % theo khung. */
  pin: { x: number; y: number };
  certifications: Certification[];
  timeline: FamilyEvent[];
  gallery: GalleryShot[];
  /** Không khai thì mặc định là nghệ nhân đại diện (xem `householdMakers`). */
  makers?: Maker[];
  /** Không khai thì mặc định một xưởng vừa làm vừa đón khách tại `address` (xem `householdWorkshops`). */
  workshops?: DemoWorkshop[];
}

export type LogStage = 'clay' | 'throw' | 'dry' | 'paint' | 'glaze' | 'fire' | 'finish';

/** Mốc nhật ký đã niêm phong (BR-01): `seq`, `mediaChecksums`, `prevHash`, `hash` đầy đủ 64 hex. */
export interface LogEntry extends ChainEntry {
  stage: LogStage;
  tint: string;
}

/** Mốc nhật ký trước khi niêm phong. */
type RawLogEntry = Pick<
  LogEntry,
  'stage' | 'at' | 'note' | 'tint' | 'supersedesSeq' | 'skipReason'
>;

export interface Product {
  slug: string;
  code: string;
  name: string;
  artisanSlug: string;
  category: string;
  material: string;
  dimensions: string;
  weightGrams: number;
  price: number;
  oneOfAKind: boolean;
  stock: number;
  tint: string;
  /** Ảnh thật; không có thì hiện hình bình vẽ tay trên nền `tint`. */
  photo?: DemoPhotoRef;
  description: string;
  artisanNote: string;
  /** Ghi công người làm; không khai thì ghi cho nghệ nhân đại diện của hộ. */
  makers?: MakerCredit[];
  log: LogEntry[];
  scans: number;
}

/** Phần chia của một hộ trong chào giá liên kết, như bên mua thấy (không có giá nội bộ). */
export interface BidShare {
  /** Tên hộ hiển thị cho bên mua. */
  household: string;
  quantity: number;
  completionDate: string;
}

export interface DemoContribution {
  /** ID hộ (slug mẫu; thật thì là UUID từ API). */
  householdId: string;
  /** Mức tối đa hộ khai. */
  maxQuantity: number;
  /** Đơn giá hộ khai (VND) — nội bộ giữa hộ và BQL, không hiện cho bên mua. */
  unitPriceVnd: number;
  /** Ngày hoàn thành hộ hứa, tuyệt đối (ISO). */
  completionDate: string;
  /** Phiên bản đóng góp (If-Match). */
  contributionVersion: number;
}

export interface NewsItem {
  slug: string;
  title: string;
  date: string;
  tag: string;
  tint: string;
  photo?: DemoPhotoRef;
}

export interface VillageStats {
  households: number;
  products: number;
  scans: number;
  years: number;
}

const artisans: Artisan[] = [
  {
    slug: 'gom-minh-hai',
    household: 'Gốm Minh Hải',
    artisanName: 'Nguyễn Minh Hải',
    title: 'Nghệ nhân ưu tú',
    craft: 'Gốm men lam',
    foundedYear: 1962,
    generation: 5,
    address: 'Xóm 3, thôn Giang Cao, Bát Tràng',
    quote: 'Đất Bát Tràng không vội. Mình vội thì bình nứt ngay trong lò.',
    story: [
      'Lò nhà Minh Hải đỏ lửa từ đời ông cố, khi gốm còn chở bằng thuyền xuôi sông Hồng. Mỗi đời giữ một bí quyết pha men lam riêng, chỉ truyền cho người con theo nghề.',
      'Ngày nay xưởng có tám thợ, vẫn vuốt tay trên bàn xoay và vẽ lam bằng bút lông. Anh Hải làm bình hút lộc, bát chiết yêu, và nhận đơn số lượng lớn cho trường học, khách sạn.',
    ],
    tint: '#8a5a3c',
    portrait: {
      id: 'chan-dung-minh-hai',
      alt: 'Bàn tay đang chuốt thành một chiếc bát gốm trắng trên bàn xoay, ngón tay bọc da mỏng',
    },
    banner: {
      id: 'bia-minh-hai',
      alt: 'Hai lò nung gạch cao hình chóp, vách gạch cũ nhiều lỗ thông hơi, cỏ mọc quanh chân lò dưới trời trong',
    },
    openNow: true,
    hours: '7:30 – 17:30',
    capacityPerMonth: 1200,
    rating: 4.9,
    completedOrders: 38,
    pin: { x: 38, y: 42 },
    makers: [
      { name: 'Nguyễn Minh Hải', role: 'Nghệ nhân ưu tú, pha men' },
      { name: 'Đỗ Văn Bình', role: 'Thợ vuốt' },
      { name: 'Phạm Thị Lan', role: 'Thợ vẽ lam' },
    ],
    workshops: [
      {
        id: 'minh-hai-showroom',
        name: 'Phòng trưng bày Minh Hải',
        address: 'Số 12 đường Gốm, Bát Tràng',
        purpose: 'SHOWROOM',
        acceptsVisitors: true,
        visitingInfo: 'Mở cửa 7:30 – 17:30 hằng ngày. Đoàn trên 10 người xin hẹn trước.',
        pin: { x: 38, y: 42 },
      },
      {
        id: 'minh-hai-kiln',
        name: 'Lò nung Giang Cao',
        address: 'Xóm 3, thôn Giang Cao, Bát Tràng',
        purpose: 'PRODUCTION',
        acceptsVisitors: false,
        pin: { x: 56, y: 63 },
      },
    ],
    certifications: [
      { name: 'Nghệ nhân ưu tú', issuer: 'Chủ tịch nước', year: 2019, verified: true },
      { name: 'OCOP 4 sao', issuer: 'UBND TP. Hà Nội', year: 2023, verified: true },
      { name: 'Giải Bàn tay vàng', issuer: 'Hiệp hội Làng nghề', year: 2024, verified: false },
    ],
    timeline: [
      {
        year: 1962,
        title: 'Đỏ lửa lò bầu',
        text: 'Cụ Nguyễn Văn Sinh dựng lò bầu đầu tiên bên bến sông.',
      },
      {
        year: 1985,
        title: 'Men lam riêng',
        text: 'Ông Nguyễn Văn Tâm pha thành công công thức men lam xám tro.',
      },
      {
        year: 2003,
        title: 'Chuyển lò ga',
        text: 'Lò ga giúp nhiệt đều, tỉ lệ thành phẩm lên 92%.',
      },
      { year: 2019, title: 'Nghệ nhân ưu tú', text: 'Anh Minh Hải được phong tặng danh hiệu.' },
      { year: 2026, title: 'Lên vCraft', text: 'Mỗi món ra lò mang một ấn truy xuất.' },
    ],
    gallery: [
      {
        caption: 'Dãy bàn xoay trong xưởng',
        ratio: '3/2',
        tint: '#9e8f86',
        photo: {
          id: 'ban-xoay-xuong',
          alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
        },
      },
      {
        caption: 'Bàn tay chuốt gốm',
        ratio: '3/4',
        tint: '#9f938a',
        photo: {
          id: 'ban-tay-vuot-gom',
          alt: 'Hai bàn tay đeo ngón bọc da, đang chuốt thành một chiếc bát gốm trắng trên bàn xoay',
        },
      },
      {
        caption: 'Bình hoa lam',
        ratio: '1/1',
        tint: '#636684',
        photo: {
          id: 'binh-hoa-lam',
          alt: 'Hai chiếc bình sứ trắng vẽ hoa văn lam: một bình có cảnh nhà bên sông, một bình dáng lục giác',
        },
      },
      {
        caption: 'Khuôn thạch cao phơi sân',
        ratio: '3/2',
        tint: '#7b6b57',
        photo: {
          id: 'khuon-phoi-san',
          alt: 'Các khuôn thạch cao trắng xếp thành hàng trên giá phơi ngoài sân, cạnh những khuôn đất nung đỏ',
        },
      },
      {
        caption: 'Than phơi bên tường lò',
        ratio: '3/4',
        tint: '#6e6d6d',
        photo: {
          id: 'than-phoi-tuong',
          alt: 'Những viên than đen ép tròn được dán kín trên một bức tường gạch cũ ở làng gốm',
        },
      },
      {
        caption: 'Khuôn đúc bình lớn',
        ratio: '3/2',
        tint: '#857d75',
        photo: {
          id: 'khuon-binh-lon',
          alt: 'Các khuôn thạch cao cao gần hai mét, buộc dây, dựng trong xưởng đúc bình lớn',
        },
      },
    ],
  },
  {
    slug: 'gom-lam-ngoc',
    household: 'Gốm Lam Ngọc',
    artisanName: 'Trần Thị Ngọc',
    title: 'Thợ cả',
    craft: 'Gốm men ngọc',
    foundedYear: 1978,
    generation: 3,
    address: 'Xóm 5, thôn Bát Tràng',
    quote: 'Men ngọc phải nhìn dưới nắng mới biết đạt hay chưa.',
    story: ['Xưởng nhỏ chuyên men ngọc và men rạn, làm ấm trà, bình và hũ theo đơn đặt.'],
    tint: '#5e8a7d',
    portrait: {
      id: 'chan-dung-lam-ngoc',
      alt: 'Một người thợ ngồi trên ghế nhựa vàng, nhìn nghiêng, giữa những hàng bình gốm mộc màu be trong xưởng',
    },
    banner: {
      id: 'bia-lam-ngoc',
      alt: 'Kệ kính bày nhiều hũ gốm quai cung đắp nổi men nâu xanh rạn nhẹ, cạnh những bình men lam trắng',
    },
    openNow: true,
    hours: '8:00 – 17:00',
    capacityPerMonth: 900,
    rating: 4.8,
    completedOrders: 24,
    pin: { x: 61, y: 30 },
    certifications: [{ name: 'OCOP 3 sao', issuer: 'UBND TP. Hà Nội', year: 2022, verified: true }],
    timeline: [],
    gallery: [
      {
        caption: 'Chiếc hũ men ngọc',
        ratio: '1/1',
        tint: '#757a6c',
        photo: {
          id: 'ln-hu-men-ngoc',
          alt: 'Chiếc hũ gốm men xanh ngọc nhạt rạn mảnh, thân tròn, miệng nhỏ, quai cung phía trên và hai quai vòng hai bên',
        },
      },
      {
        caption: 'Bình quai men xanh lục',
        ratio: '3/4',
        tint: '#4a5042',
        photo: {
          id: 'ln-am-men-xanh',
          alt: 'Bình gốm thân men ngà loang xanh lục, quai cung xanh đậm đắp nổi hình dây leo, miệng tròn nhỏ',
        },
      },
      {
        caption: 'Hũ quai men rạn xám nâu',
        ratio: '3/2',
        tint: '#737067',
        photo: {
          id: 'ln-bo-am-quai-ran',
          alt: 'Nhiều hũ gốm men xám nâu rạn nhẹ, quai cung đắp nổi, xếp trong tủ kính',
        },
      },
      {
        caption: 'Cửa lò xây vòm',
        ratio: '3/4',
        tint: '#80776d',
        photo: {
          id: 'ln-cua-lo-vom',
          alt: 'Cửa lò nung xây bằng gạch đỏ, vòm nhọn, bên trong tối',
        },
      },
    ],
  },
  {
    slug: 'lo-duc-phat',
    household: 'Lò Đức Phát',
    artisanName: 'Lê Đức Phát',
    title: 'Chủ lò',
    craft: 'Gốm gia dụng',
    foundedYear: 1990,
    generation: 2,
    address: 'Thôn Giang Cao, Bát Tràng',
    quote: 'Đơn lớn thì cần nhịp đều, mẻ nào cũng như mẻ nào.',
    story: ['Lò công suất lớn, mạnh về cốc, bát in logo cho doanh nghiệp.'],
    tint: '#a8482a',
    portrait: {
      id: 'chan-dung-duc-phat',
      alt: 'Người thợ ngồi quay lưng giữa nền xưởng, quanh là chậu và bình gốm mộc màu hồng, kem, bên cạnh xô nước men trắng',
    },
    banner: {
      id: 'bia-duc-phat',
      alt: 'Xưởng lớn với giàn khay gốm xếp cao, những giỏ tre và một người thợ ngồi làm việc ở xa',
    },
    openNow: false,
    hours: '7:00 – 18:00',
    capacityPerMonth: 1500,
    rating: 4.6,
    completedOrders: 61,
    pin: { x: 72, y: 64 },
    certifications: [],
    timeline: [],
    gallery: [
      {
        caption: 'Bát chậu xếp rơm',
        ratio: '3/2',
        tint: '#7d7865',
      },
      {
        caption: 'Chậu men nâu',
        ratio: '3/2',
        tint: '#74654f',
        photo: {
          id: 'dp-chau-nau',
          alt: 'Chậu và nồi gốm men nâu, men xám đặt cạnh rơm và rổ tre',
        },
      },
      {
        caption: 'Chậu cây gốm nâu',
        ratio: '1/1',
        tint: '#685b51',
        photo: {
          id: 'dp-chau-dat-nung',
          alt: 'Những chiếc chậu gốm nâu cao, chạm nổi hoa văn, xếp trước một cửa hàng',
        },
      },
      {
        caption: 'Gốm đất nung cam',
        ratio: '3/4',
        tint: '#654736',
        photo: {
          id: 'dp-chum-cam',
          alt: 'Hàng chục bình và lọ gốm đất nung màu cam, khắc hoa văn, xếp chồng lên nhau',
        },
      },
    ],
  },
  {
    slug: 'gom-hanh-thuy',
    household: 'Gốm Hạnh Thủy',
    artisanName: 'Phạm Hạnh Thủy',
    title: 'Nghệ nhân trẻ',
    craft: 'Gốm vẽ tay',
    foundedYear: 2008,
    generation: 4,
    address: 'Xóm 2, thôn Bát Tràng',
    quote: 'Mỗi nét bút là một lần thở ra thật chậm.',
    story: ['Nhận vẽ tay theo yêu cầu, đặc biệt là hoa sen và chim lạc.'],
    tint: '#8c6a24',
    portrait: {
      id: 'chan-dung-hanh-thuy',
      alt: 'Bàn tay cầm một chiếc chén trắng, quanh là những chén gốm xếp trên bàn cạnh xô nước men đỏ; người thợ cúi đầu, không thấy mặt',
    },
    banner: {
      id: 'bia-hanh-thuy',
      alt: 'Gian hàng gốm với những kệ đầy bát, đĩa và bình men lam trắng xếp thành dãy',
    },
    openNow: true,
    hours: '9:00 – 18:00',
    capacityPerMonth: 600,
    rating: 4.9,
    completedOrders: 17,
    pin: { x: 24, y: 70 },
    certifications: [
      { name: 'Giải trẻ sáng tạo', issuer: 'Sở VH-TT Hà Nội', year: 2025, verified: true },
    ],
    timeline: [],
    gallery: [
      {
        caption: 'Bình vẽ tre trúc',
        ratio: '3/4',
        tint: '#8a8174',
        photo: {
          id: 'ht-binh-hoa-lam-vo',
          alt: 'Chiếc bình men ngà vẽ cây trúc và chim bằng nét xanh đen, miệng loe, đặt cạnh những bình khác',
        },
      },
      {
        caption: 'Đèn dầu sứ',
        ratio: '1/1',
        tint: '#7d8793',
        photo: {
          id: 'ht-den-dau-su',
          alt: 'Chiếc đèn dầu bằng sứ trắng vẽ rồng lam, bên cạnh những bình sứ vẽ mây',
        },
      },
      {
        caption: 'Đế lư men ngà vẽ chàm',
        ratio: '3/2',
        tint: '#8b8f90',
        photo: {
          id: 'ht-de-lu-chu-dau',
          alt: 'Đế lư tròn men ngà có chân cuộn, vẽ chàm đậm hình đầu thú và rồng',
        },
      },
      {
        caption: 'Bình lê men trắng xanh',
        ratio: '3/4',
        tint: '#8a8d77',
        photo: {
          id: 'ht-binh-ngoc-ho-xuan',
          alt: 'Bình dáng quả lê thon, thân vẽ chim bằng lam trên nền men trắng xanh nhạt',
        },
      },
    ],
  },
];

const rawProducts: (Omit<Product, 'log'> & { log: RawLogEntry[] })[] = [
  {
    slug: 'binh-hut-loc-men-lam-bt7k2qxm',
    code: 'BT7K2QXM',
    name: 'Bình hút lộc men lam',
    artisanSlug: 'gom-minh-hai',
    category: 'Bình gốm',
    material: 'Đất sét trắng Trúc Thôn, men lam xám tro',
    dimensions: 'Cao 32 cm · Miệng 9 cm · Bụng 22 cm',
    weightGrams: 2400,
    price: 4_800_000,
    oneOfAKind: true,
    stock: 1,
    tint: '#3f5a8a',
    photo: {
      id: 'binh-men-lam-xam',
      alt: 'Bình gốm Bát Tràng cổ cao, bụng tròn, men xám lam, đắp nổi cành cây và một người cầm cần câu nhuốm vàng',
    },
    description:
      'Bình dáng tỏi vuốt tay, đắp nổi cành cây và người cầm cần câu trên nền sóng nước quanh bụng. Men lam xám tro pha theo công thức gia đình, nung lò gạch truyền thống lần cuối ở 1.280°C nên mỗi chiếc có sắc lam riêng.',
    artisanNote:
      'Chiếc này tôi làm mất ba buổi sáng. Sóng nước là quê mình, người ngồi câu là cái nhàn mình mong.',
    makers: [
      { name: 'Đỗ Văn Bình', contribution: 'Vuốt dáng' },
      { name: 'Phạm Thị Lan', contribution: 'Vẽ lam' },
      { name: 'Nguyễn Minh Hải', contribution: 'Pha men, nung' },
    ],
    scans: 128,
    log: [
      {
        stage: 'clay',
        at: '2026-09-02T07:40:00+07:00',
        note: 'Nhào đất Trúc Thôn, ủ 7 ngày.',
        tint: '#a88d6c',
      },
      {
        stage: 'throw',
        at: '2026-09-09T08:15:00+07:00',
        note: 'Vuốt dáng tỏi trên bàn xoay, cao 34 cm khi ướt.',
        tint: '#8a5a3c',
      },
      {
        stage: 'dry',
        at: '2026-09-16T15:00:00+07:00',
        note: 'Phơi bóng râm 6 ngày, sửa chân đế.',
        tint: '#c9b28f',
      },
      {
        stage: 'paint',
        at: '2026-09-23T09:30:00+07:00',
        note: 'Vẽ lam nền sóng nước, đắp nổi cành cây và người cầm cần câu.',
        tint: '#3b5079',
      },
      {
        stage: 'glaze',
        at: '2026-09-28T10:00:00+07:00',
        note: 'Tráng men lam xám tro, dày 0,6 mm.',
        tint: '#6b7f9c',
      },
      {
        stage: 'fire',
        at: '2026-10-03T05:00:00+07:00',
        note: 'Nung lò ga 14 giờ, đỉnh 1.280°C.',
        tint: '#c2522a',
      },
      {
        stage: 'finish',
        at: '2026-10-05T14:20:00+07:00',
        note: 'Ra lò, kiểm tra, đóng ấn đáy.',
        tint: '#3f5a8a',
      },
      {
        // Mốc đính chính (vCRAFT-9hg.4): mốc 6 ghi nhầm lò ga; mốc gốc vẫn hiện cạnh bản đính chính.
        stage: 'fire',
        at: '2026-10-03T05:00:00+07:00',
        note: 'Đính chính: nung lò gạch truyền thống 16 giờ chứ không phải lò ga, đỉnh 1.280°C.',
        tint: '#c2522a',
        supersedesSeq: 5,
      },
    ],
  },
  {
    slug: 'am-tra-men-ngoc-ln4r8tpa',
    code: 'LN4R8TPA',
    name: 'Ấm trà men ngọc',
    artisanSlug: 'gom-lam-ngoc',
    category: 'Ấm chén',
    material: 'Đất sét, men ngọc',
    dimensions: 'Dung tích 450 ml',
    weightGrams: 700,
    price: 890_000,
    oneOfAKind: false,
    stock: 12,
    tint: '#6f9a8b',
    description:
      'Ấm trà men ngọc xanh nhạt, thân múi dưa, nắp hình cánh sen, quai vòng; men rạn mảnh toàn thân.',
    artisanNote: '',
    scans: 54,
    log: [],
  },
  {
    slug: 'bat-ve-sen-men-trong-hx2m9kqd',
    code: 'HX2M9KQD',
    name: 'Bát vẽ sen men trong',
    artisanSlug: 'gom-hanh-thuy',
    category: 'Bát đĩa',
    material: 'Đất sét trắng, men trong',
    dimensions: 'Đường kính 16 cm',
    weightGrams: 420,
    price: 380_000,
    oneOfAKind: false,
    stock: 40,
    tint: '#b4895a',
    description: 'Bát vẽ tay hoa sen xanh lam trong lòng bát, men trong.',
    artisanNote: '',
    scans: 31,
    log: [],
  },
  {
    slug: 'coc-men-trang-quai-tron-df6p3wze',
    code: 'DF6P3WZE',
    name: 'Cốc men trắng quai tròn',
    artisanSlug: 'lo-duc-phat',
    category: 'Cốc',
    material: 'Đất sét, men trắng',
    dimensions: '330 ml',
    weightGrams: 310,
    price: 145_000,
    oneOfAKind: false,
    stock: 300,
    tint: '#9a8064',
    description: 'Cốc thân thẳng men trắng bóng, quai tròn, có thể in logo theo đơn.',
    artisanNote: '',
    scans: 12,
    log: [],
  },
];

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Mốc thời gian mẫu tính từ thời điểm hiện tại (`days` ngày, giờ `hour` theo múi giờ +07:00) để
 * bản trình diễn không tự hỏng khi hạn chào giá cố định đã qua (domain chỉ cho chốt tới 7 ngày sau hạn,
 * BR-L2). Trang RFQ đặt `revalidate` nên mốc này được tính lại định kỳ.
 */
function rel(days: number, hour = 17): string {
  const d = new Date(Date.now() + days * DAY_MS);
  d.setUTCHours(hour - 7, 0, 0, 0);
  return d.toISOString();
}

const news: NewsItem[] = [
  {
    slug: 'hoi-cho-gom-mua-dong',
    title: 'Hội chợ gốm mùa đông mở cửa từ 15/11',
    date: '2026-10-25',
    tag: 'Sự kiện',
    tint: '#a8482a',
  },
  {
    slug: 'lop-vuot-gom-cuoi-tuan',
    title: 'Lớp vuốt gốm cuối tuần cho thiếu nhi',
    date: '2026-10-21',
    tag: 'Trải nghiệm',
    tint: '#5e8a7d',
    photo: {
      id: 'ban-xoay-xuong',
      alt: 'Những bàn xoay gỗ thấp đặt rải rác trên nền gạch đỏ trong một xưởng gốm',
    },
  },
  {
    slug: 'gia-dat-set-quy-4',
    title: 'Giá đất sét quý IV tăng nhẹ 3%',
    date: '2026-10-16',
    tag: 'Vật liệu',
    tint: '#8c6a24',
    photo: {
      id: 'news-dat-set',
      alt: 'Đống đất sét nâu đỏ chất cao trong nhà kho rộng, phía sau là hàng ngói đất nung',
    },
  },
];

const delay = <T>(value: T) => Promise.resolve(value);

/** Niêm phong nhật ký (BR-01) một lần, dùng lại cho mọi lần gọi. */
async function sealProduct(p: (typeof rawProducts)[number]): Promise<Product> {
  const contents = await Promise.all(
    p.log.map(async (entry, i) => ({
      ...entry,
      // Ảnh minh chứng là ảnh giữ chỗ; checksum cũng là dữ liệu mẫu, cố định theo mã + vị trí.
      mediaChecksums: [await sha256Hex(`demo-photo:${p.code}:${i}`)],
    })),
  );
  return { ...p, log: await sealChain(p.code, contents) };
}

/** Người làm của hộ; mặc định là nghệ nhân đại diện. */
export function householdMakers(a: Artisan): Maker[] {
  return a.makers ?? [{ name: a.artisanName, role: a.title }];
}

/** Xưởng của hộ; mặc định một nơi vừa làm vừa đón khách theo giờ mở cửa đã khai. */
export function householdWorkshops(a: Artisan): DemoWorkshop[] {
  return (
    a.workshops ?? [
      {
        id: `${a.slug}-workshop`,
        name: a.household,
        address: a.address,
        purpose: 'BOTH',
        acceptsVisitors: a.openNow,
        visitingInfo: a.hours,
        pin: a.pin,
      },
    ]
  );
}

/** Ghi công người làm của sản phẩm; mặc định ghi cho nghệ nhân đại diện. */
export function productMakers(p: Product, a: Artisan): MakerCredit[] {
  return p.makers ?? [{ name: a.artisanName, contribution: a.craft }];
}

let sealed: Promise<Product[]> | undefined;
const loadProducts = () => {
  sealed ??= Promise.all(rawProducts.map(sealProduct));
  return sealed;
};

export const getArtisans = () => delay(artisans);
export const getArtisan = (slug: string) => delay(artisans.find((a) => a.slug === slug) ?? null);
export const getProducts = () => loadProducts();
export const getProduct = async (slug: string) =>
  (await loadProducts()).find((p) => p.slug === slug) ?? null;
export const getProductByCode = async (code: string) =>
  (await loadProducts()).find((p) => p.code === code.toUpperCase()) ?? null;
export const getProductsByArtisan = async (slug: string) =>
  (await loadProducts()).filter((p) => p.artisanSlug === slug);
export const getNews = () => delay(news);
export const getVillageStats = (): Promise<VillageStats> =>
  delay({ households: 142, products: 1860, scans: 23_400, years: 700 });

/** Tham số tĩnh để dựng sẵn các trang mẫu. */
export const demoParams = {
  artisans: artisans.map((a) => a.slug),
  products: rawProducts.map((p) => p.slug),
  traceCodes: rawProducts.map((p) => p.code),
};
