import type {
  HouseholdCertification,
  HouseholdGalleryItem,
  HouseholdTimelineEvent,
} from '../../entities/household.entity.js';
import { DEMO_PHOTOS } from './photo-manifest.js';

/**
 * Profile depth of the demo households (GH#473): a family timeline and a quality certification for every approved
 * household, a full profile for Lò Đức Phát, experience offers on a few showrooms and a photo gallery on the demo
 * products. Everything here is derived from the household's index and facts, never from the seeded random stream,
 * so the frozen ids and trace codes stay as they are.
 *
 * The household story is invented, so the timeline must not claim a real person's history; the certifications are
 * village or cooperative level and never an award a real issuer gave to a real business.
 */

/** The year the timeline stops at: the snapshot year of the demo. */
const TIMELINE_END_YEAR = 2026;

export interface TimelineInput {
  owner: string;
  /** The household's craft text, e.g. "men lam" (reads as "gắn với men lam"). */
  craft: string;
  foundedYear: number;
  /** Position in the seed's household list; picks the wording variant and the number of events. */
  index: number;
}

/** Number of timeline events of the household at `index`: 3, 4 or 5. */
export const timelineLength = (index: number): 3 | 4 | 5 => (3 + (index % 3)) as 3 | 4 | 5;

/**
 * A plausible family timeline of 3 to 5 events for a household founded in `foundedYear`: years strictly increase,
 * the first is the founding year and none is after {@link TIMELINE_END_YEAR}. The events follow what happened in
 * Bát Tràng workshops over those decades (kilns changing from wood and coal to gas, the next generation learning,
 * a showroom for visitors) without naming anyone but the household's owner.
 */
export function familyTimeline(input: TimelineInput): HouseholdTimelineEvent[] {
  const { owner, craft, foundedYear, index } = input;
  const span = Math.max(TIMELINE_END_YEAR - foundedYear, 12);
  const at = (share: number) => foundedYear + Math.round(span * share);
  const slots: Record<
    'founding' | 'next' | 'kiln' | 'visitors' | 'online',
    HouseholdTimelineEvent
  > = {
    founding: {
      year: foundedYear,
      title: 'Nhóm lò đầu tiên',
      text: `Gia đình dựng lò và bắt đầu làm gốm ở Bát Tràng; sau này nghề của nhà gắn với ${craft}.`,
    },
    next: {
      year: at(0.3),
      title: 'Truyền nghề cho con cháu',
      text: 'Con cháu trong nhà bắt đầu học vuốt đất, pha men và đứng lò bên cạnh người lớn.',
    },
    kiln:
      index % 2 === 0
        ? {
            year: at(0.6),
            title: 'Chuyển sang lò gas',
            text: 'Xưởng thay lò củi và lò than bằng lò nung gas: men lên màu đều hơn và xóm bớt khói.',
          }
        : {
            year: at(0.6),
            title: 'Xây thêm nhà xưởng',
            text: `Chủ hộ ${owner} cùng gia đình xây thêm gian vuốt đất và gian phơi mộc để nhận đơn đều quanh năm.`,
          },
    visitors: {
      year: at(0.85),
      title: 'Mở cửa đón khách',
      text: 'Xưởng mở phòng trưng bày, đón khách tham quan và xem thợ làm gốm tại chỗ.',
    },
    online: {
      year: TIMELINE_END_YEAR,
      title: 'Lên vCRAFT',
      text: 'Hộ đăng hồ sơ, đăng sản phẩm và ghi nhật ký sản xuất có mã QR trên vCRAFT.',
    },
  };
  const keys: Array<keyof typeof slots> =
    timelineLength(index) === 3
      ? ['founding', 'kiln', 'visitors']
      : timelineLength(index) === 4
        ? ['founding', 'next', 'kiln', 'visitors']
        : ['founding', 'next', 'kiln', 'visitors', 'online'];
  return keys.map((key) => slots[key]);
}

/** Generic village-level certifications; the board marks one `verified` only after it saw the document. */
const BOARD = 'Ban quản lý làng nghề Bát Tràng';
const GROUP = 'Tổ hợp tác thợ gốm Bát Tràng';
const CERTIFICATION_POOL: ReadonlyArray<Pick<HouseholdCertification, 'name' | 'issuer'>> = [
  { name: 'Cơ sở đạt chuẩn men an toàn thực phẩm', issuer: BOARD },
  { name: 'Thợ giỏi cấp làng nghề', issuer: GROUP },
  { name: 'Xưởng nung sạch, tiết kiệm nhiên liệu', issuer: BOARD },
  { name: 'Cam kết hàng thủ công truy xuất nguồn gốc', issuer: GROUP },
];

/**
 * One or two village-level certifications of the household at `index`. The first is verified by the board for
 * three out of four households; the second (every third household has one) always waits for the board.
 */
export function householdCertifications(
  index: number,
  foundedYear: number,
): HouseholdCertification[] {
  const earliest = foundedYear + 5;
  const first = CERTIFICATION_POOL[
    index % CERTIFICATION_POOL.length
  ] as (typeof CERTIFICATION_POOL)[number];
  const result: HouseholdCertification[] = [
    {
      ...first,
      year: Math.min(Math.max(earliest, 2018 + (index % 7)), 2025),
      verified: index % 4 !== 3,
    },
  ];
  if (index % 3 === 0) {
    const second = CERTIFICATION_POOL[
      (index + 1) % CERTIFICATION_POOL.length
    ] as (typeof CERTIFICATION_POOL)[number];
    result.push({ ...second, year: Math.min(Math.max(earliest, 2024), 2026), verified: false });
  }
  return result;
}

export interface ExperienceOffer {
  name: string;
  detail: string;
  durationMinutes: number;
  priceVnd: number;
}

/**
 * Experience offers of seven household showrooms, by household index (a household's first workshop always takes
 * visitors). Name, duration and price are stored on the workshop; the name opens the description.
 */
export const EXPERIENCE_OFFERS: Readonly<Record<number, ExperienceOffer>> = {
  0: {
    name: 'Vẽ lam lên chén của riêng bạn',
    detail:
      'Thợ cả hướng dẫn pha men lam và vẽ cành tre, hoa cúc lên một chiếc chén mộc. Chén được nung trong mẻ lò kế tiếp và gửi về cho bạn.',
    durationMinutes: 120,
    priceVnd: 280_000,
  },
  1: {
    name: 'Thử pha men ngọc trên mảnh gốm',
    detail:
      'Khách pha ba tỷ lệ men ngọc, tráng lên mảnh gốm thử và ghi vào sổ men của xưởng; mang về mảnh gốm đã nung.',
    durationMinutes: 90,
    priceVnd: 220_000,
  },
  2: {
    name: 'Tự tay vuốt chiếc cốc men trắng',
    detail:
      'Ngồi bàn xoay cùng thợ của lò, vuốt một chiếc cốc, gắn quai và chọn men trắng. Cốc nung xong được đóng gói gửi tận nhà.',
    durationMinutes: 150,
    priceVnd: 320_000,
  },
  3: {
    name: 'Vẽ hoa sen lên bát sứ',
    detail:
      'Chủ xưởng chỉ cách cầm bút lông và đi nét hoa sen, chim lạc. Mỗi khách vẽ một chiếc bát, nét nào cũng là nét tay.',
    durationMinutes: 120,
    priceVnd: 260_000,
  },
  5: {
    name: 'Buổi trà tại xưởng ấm chén men nâu',
    detail:
      'Xem cách lọc đất và mài khít nắp ấm, sau đó ngồi uống một ấm trà với bộ chén men nâu ngay trong xưởng.',
    durationMinutes: 60,
    priceVnd: 150_000,
  },
  8: {
    name: 'Tráng men và vẽ viền lam lên đĩa',
    detail:
      'Tráng men trắng ngà lên một chiếc đĩa mộc rồi vẽ đường viền lam mảnh. Đĩa được nung và gửi về sau vài ngày.',
    durationMinutes: 90,
    priceVnd: 200_000,
  },
  11: {
    name: 'Góc trà: học pha trà và chọn tách',
    detail:
      'Chủ xưởng pha trà theo từng loại tách, cho khách thử cầm tách mỏng miệng loe và chọn một chiếc mang về.',
    durationMinutes: 75,
    priceVnd: 180_000,
  },
};

/** The three experience fields stored on a workshop. */
export function experienceFields(offer: ExperienceOffer) {
  return {
    experienceDescription: `${offer.name}. ${offer.detail}`,
    experienceDurationMinutes: offer.durationMinutes,
    experiencePriceVnd: offer.priceVnd,
  };
}

/** Index of Lò Đức Phát in the seed's household list (the household that signs in). */
export const LO_DUC_PHAT_INDEX = 2;

/** Id of the hand-drawn seal of Lò Đức Phát (`scripts/demo/photos/make-household-seal.mjs`). */
export const LO_DUC_PHAT_SEAL_PHOTO = 'con-dau-duc-phat';

const photoAlt = (id: string): string => {
  const photo = DEMO_PHOTOS.find((p) => p.id === id);
  if (!photo) throw new Error(`Ảnh minh hoạ "${id}" không có trong bảng ánh xạ`);
  return photo.alt;
};

/** Photos of Lò Đức Phát's workshop gallery in Studio, besides the three the village board linked to the page. */
const LO_DUC_PHAT_GALLERY: ReadonlyArray<{ photo: string; caption: string }> = [
  { photo: 'ban-xoay-xuong', caption: 'Dãy bàn xoay trong xưởng' },
  { photo: 'ban-tay-vuot-gom', caption: 'Bàn tay chuốt bát trắng' },
];

/** Photo ids Lò Đức Phát's own profile points at (a media id is made from them by the seed). */
export const loDucPhatProfile = {
  timeline: [
    {
      year: 1954,
      title: 'Ông cố nhóm lò đầu tiên',
      text: 'Ông cố nhóm lò, nung chén bát cho cả xóm ăn cơm; đó là mẻ gốm gia dụng đầu tiên của nhà.',
    },
    {
      year: 1976,
      title: 'Đời thứ hai nối nghề',
      text: 'Ông nội nhận lò từ ông cố, giữ nghề chén bát và thêm những chiếc bát ăn cơm dày thành.',
    },
    {
      year: 1998,
      title: 'Chuyển sang lò gas',
      text: 'Lò củi được thay bằng lò nung gas, giúp mẻ nung ổn định và đều men hơn.',
    },
    {
      year: 2012,
      title: 'Anh Phát nhận lò',
      text: 'Anh Lê Đức Phát nhận lò từ cha, đời thứ tư làm đồ gốm dùng hằng ngày; vợ anh đứng khâu kiểm hàng và đóng gói.',
    },
    {
      year: 2024,
      title: 'Nhận đơn cốc in logo',
      text: 'Lò bắt đầu nhận đơn cốc và bát in logo cho quà tặng hội nghị, chia lô và ghi nhật ký từng đợt.',
    },
  ] satisfies HouseholdTimelineEvent[],
  certifications: [
    {
      name: 'Cơ sở đạt chuẩn men an toàn thực phẩm',
      issuer: BOARD,
      year: 2023,
      issuedOn: '2023-05-12',
      verified: true,
    },
    {
      name: 'Thợ giỏi cấp làng nghề',
      issuer: GROUP,
      year: 2025,
      issuedOn: '2025-03-20',
      verified: false,
    },
  ] satisfies HouseholdCertification[],
  sealAlt: 'Con dấu đỏ vuông của Lò Đức Phát, khắc chữ "Đức Phát" và dòng "Lò gốm Bát Tràng"',
  gallery: LO_DUC_PHAT_GALLERY,
};

/** The Studio gallery and seal of Lò Đức Phát, with `media` turning a photo id into its media asset id. */
export function loDucPhatPhotos(media: (photoId: string) => string): {
  sealPhoto: { mediaId: string; alt: string };
  gallery: HouseholdGalleryItem[];
} {
  return {
    sealPhoto: { mediaId: media(LO_DUC_PHAT_SEAL_PHOTO), alt: loDucPhatProfile.sealAlt },
    gallery: loDucPhatProfile.gallery.map(({ photo, caption }) => ({
      mediaId: media(photo),
      alt: photoAlt(photo),
      caption,
    })),
  };
}

/** Workshop photos of Lò Đức Phát shown beside its products (a product photo is a photo of the house that made it). */
const PRODUCT_GALLERY_POOL = [
  'ban-tay-vuot-gom',
  'ban-xoay-xuong',
  'bia-duc-phat',
  'dp-chau-nau',
  'dp-chum-cam',
] as const;

/**
 * Gallery photos of the demo products, by trace code: the QR product of the defence has three, and each of the other
 * published products of Lò Đức Phát has two. They are the village's own, already credited workshop photos (no
 * licensed photo of these exact pieces exists beyond their cover), so each is described as what it shows.
 */
export const DEMO_PRODUCT_GALLERIES: Readonly<Record<string, readonly string[]>> = {
  DF6P3WZE: ['ban-tay-vuot-gom', 'ban-xoay-xuong', 'bia-duc-phat'],
  ...Object.fromEntries(
    [
      'P6P8HRJ7',
      'RHGYT9D9',
      'US2Y4X54',
      'JCMU8F99',
      'HBTKV2DF',
      'CEF77YDK',
      '5FZ2QSGN',
      '422ECP7G',
    ].map((code, i) => [
      code,
      [
        PRODUCT_GALLERY_POOL[i % PRODUCT_GALLERY_POOL.length],
        PRODUCT_GALLERY_POOL[(i + 2) % PRODUCT_GALLERY_POOL.length],
      ] as string[],
    ]),
  ),
};

/** `product.images` of a demo product, or undefined when it has no gallery. */
export function productGalleryImages(
  traceCode: string,
  media: (photoId: string) => string,
): Array<{ mediaId: string; alt: string }> | undefined {
  const photos = DEMO_PRODUCT_GALLERIES[traceCode];
  return photos?.map((photo) => ({ mediaId: media(photo), alt: photoAlt(photo) }));
}

/**
 * Every photo id the profiles above point at. They are not linked through `media_link`, so the photo manifest test
 * reads this list instead of a link to know the photo is used.
 */
export const PROFILE_PHOTO_IDS: readonly string[] = [
  LO_DUC_PHAT_SEAL_PHOTO,
  ...LO_DUC_PHAT_GALLERY.map((g) => g.photo),
  ...Object.values(DEMO_PRODUCT_GALLERIES).flat(),
];
