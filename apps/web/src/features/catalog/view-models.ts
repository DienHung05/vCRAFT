import type {
  JournalDto,
  JournalEntryDto,
  MediaCreditDto,
  ProductCardDto,
  WorkshopDto,
} from '@vcraft/contracts';
import type { ChainEntry, JournalStage, ProductStatus } from '@vcraft/domain';
import type { ProductFigureKind } from '@vcraft/ui';
import { PHOTO_BY_ID } from '@/lib/demo/photo-credits';
import type { ImageVariant } from '@/lib/images';
import { presetKindOf } from './preset-figure';

/** Tham chiếu ảnh có giấy phép trong `/images/demo` (kèm ghi công) hoặc ảnh tải lên qua kho media. */
export interface PhotoView {
  /** Có giá trị ⇒ ảnh trong bộ có giấy phép: `<ImageSlot photo>` vẽ AVIF/WebP và ghi công được. */
  photo?: { id: string; alt: string };
  /** Ảnh bất kỳ khác (URL công khai). */
  src?: string;
  /** Sizes of `src` for `srcset`; empty or absent when the file exists at one size only. */
  variants?: readonly ImageVariant[];
  alt: string;
}

/** Description to show for `locale`: the English one on `/en` when there is one, else the Vietnamese one. */
export function altFor(locale: string, alt: string, altEn?: string | null): string {
  return locale === 'en' && altEn?.trim() ? altEn : alt;
}

/** What the household cover is: the banner, else the household's first workshop photo (the API's `coverUrl`). */
export function householdCover(
  locale: string,
  household: {
    banner: {
      url: string | null;
      alt: string;
      altEn: string | null;
      variants: readonly ImageVariant[];
      credit: MediaCreditDto | null;
    } | null;
    coverUrl: string | null;
    coverVariants: readonly ImageVariant[];
    gallery: readonly {
      url: string | null;
      alt: string;
      altEn: string | null;
      credit: MediaCreditDto | null;
    }[];
  },
): { view: PhotoView | undefined; alt: string | null; credit: MediaCreditDto | null } {
  const { banner } = household;
  if (banner) {
    const alt = altFor(locale, banner.alt, banner.altEn);
    return { view: photoFromUrl(banner.url, alt, banner.variants), alt, credit: banner.credit };
  }
  if (!household.coverUrl) return { view: undefined, alt: null, credit: null };
  const item = household.gallery.find((g) => g.url === household.coverUrl);
  const alt = item ? altFor(locale, item.alt, item.altEn) : null;
  return {
    view: photoFromUrl(household.coverUrl, alt ?? '', household.coverVariants),
    alt,
    credit: item?.credit ?? null,
  };
}

const DEMO_PHOTO_URL = /^\/images\/demo\/(.+)-\d+\.(?:webp|avif)$/;

/** Đọc `coverUrl` của API: đường dẫn ảnh có giấy phép được đổi lại thành tham chiếu để giữ ghi công. */
export function photoFromUrl(
  url: string | null,
  alt: string,
  variants: readonly ImageVariant[] = [],
): PhotoView | undefined {
  if (!url) return undefined;
  const id = DEMO_PHOTO_URL.exec(url)?.[1];
  if (id && PHOTO_BY_ID.has(id)) return { photo: { id, alt }, alt };
  return variants.length > 0 ? { src: url, alt, variants } : { src: url, alt };
}

/** Thuộc tính ảnh truyền thẳng vào `<ImageSlot>`. */
export function slotPhoto(view: PhotoView | undefined) {
  return {
    ...(view?.photo && { photo: view.photo }),
    ...(view?.src && { src: view.src }),
    ...(view?.variants?.length && { variants: view.variants }),
  };
}

const TINTS = ['#3f5a8a', '#b4895a', '#9a8064', '#8a5a3c', '#5f7d6e', '#a4532a', '#6b6f8a'];

/** Màu nền ổn định theo mã: cùng một món luôn cùng màu khi chưa có `dominantColor` của ảnh. */
export function tintOf(seed: string): string {
  let hash = 0;
  for (const ch of seed) hash = (hash * 31 + (ch.codePointAt(0) ?? 0)) % 1_000_003;
  return TINTS[hash % TINTS.length] as string;
}

export interface ProductCardView {
  slug: string;
  name: string;
  /** Which placeholder illustration to draw while the product has no photo. */
  presetKind: ProductFigureKind;
  tint: string;
  /** `0` là chưa niêm yết giá. */
  price: number;
  oneOfAKind: boolean;
  /** A sold one-of-a-kind piece stays listed with a "sold" badge. */
  sold?: boolean;
  image?: PhotoView | undefined;
}

/** A card DTO, or a product of a household page (whose status is the full lifecycle). */
type ProductCardSource = Omit<ProductCardDto, 'status'> & { status: ProductStatus };

export function toProductCardView(dto: ProductCardSource, locale = 'vi'): ProductCardView {
  return {
    slug: dto.slug,
    name: dto.name,
    presetKind: presetKindOf(dto.category, dto.name),
    tint: tintOf(dto.traceCode),
    price: dto.priceVnd,
    oneOfAKind: dto.kind === 'OBJECT',
    sold: dto.status === 'SOLD',
    image: photoFromUrl(
      dto.coverUrl,
      altFor(locale, dto.coverAlt ?? dto.name, dto.coverAltEn),
      dto.coverVariants,
    ),
  };
}

const STAGE_TINTS: Record<JournalStage, string> = {
  clay: '#a88d6c',
  throw: '#8a5a3c',
  dry: '#c9b28f',
  paint: '#3b5079',
  glaze: '#5f7d6e',
  fire: '#c2522a',
  finish: '#3f5a8a',
};

export interface LogEntryView extends ChainEntry {
  stage: JournalStage;
  tint: string;
  /** The entry's real images, with their credits. */
  images: JournalEntryDto['images'];
}

/** Đổi nhật ký của API sang dạng chuỗi băm mà trình duyệt tự kiểm (FR-TRC-05). */
export function toLogEntries(journal: JournalDto): LogEntryView[] {
  return journal.entries.map((e) => ({
    seq: e.seq,
    stage: e.stage,
    at: e.declaredDate,
    note: e.note,
    mediaChecksums: e.images.map((image) => image.sha256),
    supersedesSeq: e.supersedesSeq ?? undefined,
    skipReason: e.skipReason ?? undefined,
    prevHash: e.prevHash,
    hash: e.hash,
    tint: STAGE_TINTS[e.stage],
    images: e.images,
  }));
}

export interface LatLngPoint {
  id: string;
  lat: number | null;
  lng: number | null;
}

/**
 * Chiếu tọa độ thật lên khung bản đồ thu nhỏ (%), chừa lề để ghim không sát mép. Điểm không có tọa
 * độ nằm giữa khung; chỉ để định hướng, bản đồ thật ở `/ban-do`.
 */
export function projectPins(points: readonly LatLngPoint[]): Map<string, { x: number; y: number }> {
  const located = points.filter((p) => p.lat !== null && p.lng !== null) as {
    id: string;
    lat: number;
    lng: number;
  }[];
  const lats = located.map((p) => p.lat);
  const lngs = located.map((p) => p.lng);
  const [south, north] = [Math.min(...lats), Math.max(...lats)];
  const [west, east] = [Math.min(...lngs), Math.max(...lngs)];
  const scale = (value: number, low: number, high: number) =>
    high === low ? 50 : 14 + ((value - low) / (high - low)) * 72;
  return new Map(
    points.map((p) => [
      p.id,
      p.lat === null || p.lng === null
        ? { x: 50, y: 50 }
        : { x: scale(p.lng, west, east), y: 100 - scale(p.lat, south, north) },
    ]),
  );
}

export interface VisitWorkshopView {
  id: string;
  name: string;
  address: string;
  purpose: WorkshopDto['purpose'];
  acceptsVisitors: boolean;
  visitingInfo?: string;
  /** Weekly hours; absent when not declared (the demo catalog declares none). */
  openingHours?: NonNullable<WorkshopDto['openingHours']>;
  experience?: NonNullable<WorkshopDto['experience']>;
  temporarilyClosed?: boolean;
  closureReason?: string;
  pin: { x: number; y: number };
}

export function toVisitWorkshops(workshops: readonly WorkshopDto[]): VisitWorkshopView[] {
  const pins = projectPins(workshops);
  return workshops.map((w) => ({
    id: w.id,
    name: w.name,
    address: w.address,
    purpose: w.purpose,
    acceptsVisitors: w.acceptsVisitors,
    ...(w.visitingInfo ? { visitingInfo: w.visitingInfo } : {}),
    ...(w.openingHours ? { openingHours: w.openingHours } : {}),
    ...(w.experience ? { experience: w.experience } : {}),
    temporarilyClosed: w.temporarilyClosed,
    ...(w.closureReason ? { closureReason: w.closureReason } : {}),
    pin: pins.get(w.id) ?? { x: 50, y: 50 },
  }));
}
