import type {
  ArtisanDto,
  HouseholdDto,
  MakerCreditDto,
  MapPinDto,
  ProductDto,
  PublicHouseholdDto,
  WorkshopDto,
} from '@vcraft/contracts';
import type { Artisan, Household, Product, ProductMaker, Workshop } from '@vcraft/database';
import {
  isVisitable,
  POSTED_BY_ADMINISTRATION,
  profileCompleteness,
  splitWorkshops,
} from '@vcraft/domain';
import type { LinkedImage, PublicLinkRole } from '../media/application/media.service';

const toNumber = (value: string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

export function toWorkshopDto(w: Workshop): WorkshopDto {
  return {
    id: w.id,
    version: w.version,
    name: w.name,
    address: w.address,
    purpose: w.purpose,
    acceptsVisitors: w.acceptsVisitors,
    visitingInfo: w.visitingInfo ?? null,
    openingHours: w.openingHours ?? null,
    lat: toNumber(w.lat),
    lng: toNumber(w.lng),
  };
}

export function toArtisanDto(a: Artisan): ArtisanDto {
  return {
    id: a.id,
    version: a.version,
    name: a.name,
    craftRole: a.craftRole ?? null,
    bio: a.bio ?? null,
  };
}

export function toMakerCreditDto(m: ProductMaker): MakerCreditDto {
  return {
    artisanId: m.artisan.id,
    name: m.artisan.name,
    craftRole: m.artisan.craftRole ?? null,
    contribution: m.contribution,
  };
}

/** Id ảnh tải lên của các sản phẩm, để tra URL một lần. */
export const productMediaIds = (products: readonly Product[]): string[] =>
  products.flatMap((p) => (p.images ?? []).map((image) => image.mediaId));

/** Bìa là bìa riêng (dữ liệu mẫu) hoặc ảnh đầu tiên đã xử lý xong. */
export function productCover(p: Product, mediaUrls?: ReadonlyMap<string, string>) {
  if (p.coverUrl) return { url: p.coverUrl, alt: p.coverAlt ?? null };
  const ready = (p.images ?? []).find((image) => mediaUrls?.has(image.mediaId));
  return ready
    ? { url: mediaUrls?.get(ready.mediaId) ?? null, alt: ready.alt }
    : { url: null, alt: null };
}

/** `makers` phải đã sắp theo `position` và nạp sẵn `artisan`. */
export function toProductDto(
  p: Product,
  makers: readonly ProductMaker[] = [],
  mediaUrls?: ReadonlyMap<string, string>,
): ProductDto {
  const cover = productCover(p, mediaUrls);
  return {
    id: p.id,
    version: p.version,
    name: p.name,
    slug: p.slug,
    traceCode: p.traceCode,
    description: p.description,
    kind: p.kind,
    batchSize: p.batchSize ?? null,
    category: p.category,
    priceVnd: p.priceVnd,
    stock: p.stock,
    material: p.material ?? null,
    dimensions: p.dimensions ?? null,
    weightGrams: p.weightGrams ?? null,
    artisanNote: p.artisanNote ?? null,
    coverUrl: cover.url,
    coverAlt: cover.alt,
    images: (p.images ?? []).map((image) => ({
      mediaId: image.mediaId,
      url: mediaUrls?.get(image.mediaId) ?? null,
      alt: image.alt,
    })),
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    makers: makers.map(toMakerCreditDto),
    postedBy: POSTED_BY_ADMINISTRATION,
  };
}

/** Ghim bản đồ; chỉ gọi với xưởng có tọa độ của hộ đã duyệt (đã nạp `household`). */
export function toMapPinDto(w: Workshop): MapPinDto {
  return {
    workshopId: w.id,
    workshopName: w.name,
    address: w.address,
    purpose: w.purpose,
    visitable: isVisitable(w),
    visitingInfo: isVisitable(w) ? (w.visitingInfo ?? null) : null,
    openingHours: isVisitable(w) ? (w.openingHours ?? null) : null,
    lat: Number(w.lat),
    lng: Number(w.lng),
    household: {
      name: w.household.name,
      slug: w.household.slug,
      craft: w.household.craft ?? null,
      coverUrl: w.household.coverUrl ?? null,
    },
  };
}

export interface HouseholdParts {
  artisans: Artisan[];
  workshops: Workshop[];
  products: Product[];
  /** Ghi công theo `product.id`. */
  makers: ReadonlyMap<string, ProductMaker[]>;
  /** URL công khai của ảnh đã xử lý xong, theo `mediaId`. */
  mediaUrls?: ReadonlyMap<string, string>;
  /** Portrait, banner and gallery images linked through `media_link`. */
  linked?: readonly LinkedImage[];
}

const linkedOf = (parts: HouseholdParts, role: PublicLinkRole) =>
  (parts.linked ?? []).filter((item) => item.role === role).map((item) => item.image);

/** Images the household attached itself in Studio. */
function toGalleryDto(h: Household, parts: HouseholdParts) {
  return (h.gallery ?? []).map((item) => ({
    mediaId: item.mediaId ?? null,
    url: item.url ?? (item.mediaId ? (parts.mediaUrls?.get(item.mediaId) ?? null) : null),
    alt: item.alt,
    caption: item.caption ?? null,
    credit: null,
  }));
}

export function toPublicHouseholdDto(h: Household, parts: HouseholdParts): PublicHouseholdDto {
  const gallery = [...linkedOf(parts, 'GALLERY'), ...toGalleryDto(h, parts)];
  const [banner] = linkedOf(parts, 'BANNER');
  return {
    id: h.id,
    name: h.name,
    slug: h.slug,
    history: h.history,
    village: h.village ?? null,
    craft: h.craft ?? null,
    // Chưa chọn bìa riêng thì dùng ảnh xưởng đầu tiên đã xử lý xong.
    coverUrl: h.coverUrl ?? banner?.url ?? gallery.find((item) => item.url)?.url ?? null,
    portrait: linkedOf(parts, 'PORTRAIT')[0] ?? null,
    banner: banner ?? null,
    foundedYear: h.foundedYear ?? null,
    generations: h.generations ?? null,
    timeline: h.timeline ?? [],
    certifications: h.certifications ?? [],
    gallery,
    capacityByCategory: h.capacityByCategory ?? {},
    artisans: parts.artisans.map(toArtisanDto),
    workshops: parts.workshops.map(toWorkshopDto),
    visit: {
      showrooms: splitWorkshops(parts.workshops).showrooms.map(toWorkshopDto),
      productionWorkshops: splitWorkshops(parts.workshops).production.map(toWorkshopDto),
    },
    products: parts.products.map((p) => toProductDto(p, parts.makers.get(p.id), parts.mediaUrls)),
  };
}

export function toHouseholdDto(h: Household, parts: HouseholdParts): HouseholdDto {
  return {
    ...toPublicHouseholdDto(h, parts),
    gallery: toGalleryDto(h, parts),
    version: h.version,
    status: h.status,
    statusReason: h.statusReason ?? null,
    approvedAt: h.approvedAt?.toISOString() ?? null,
    completeness: profileCompleteness({
      history: h.history,
      foundedYear: h.foundedYear ?? null,
      generations: h.generations ?? null,
      timelineCount: h.timeline?.length ?? 0,
      certificationCount: h.certifications?.length ?? 0,
      galleryCount: h.gallery?.length ?? 0,
      workshopHasLocation: parts.workshops.some((w) => w.lat != null && w.lng != null),
      workshopHasHours: parts.workshops.some((w) => (w.openingHours?.length ?? 0) > 0),
      capacityCategories: Object.keys(h.capacityByCategory ?? {}).length,
    }),
  };
}
