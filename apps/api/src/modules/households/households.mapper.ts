import type {
  ArtisanDto,
  CertificationDto,
  HouseholdDto,
  MakerCreditDto,
  MapPinDto,
  MediaVariantResponse,
  ProductDto,
  ProfilePhotoDto,
  PublicHouseholdDto,
  PublicImageDto,
  WorkshopDto,
} from '@vcraft/contracts';
import type {
  Artisan,
  Household,
  HouseholdPhoto,
  Product,
  ProductMaker,
  Workshop,
} from '@vcraft/database';
import {
  effectiveCraftCategory,
  householdReviewState,
  isVisitable,
  POSTED_BY_ADMINISTRATION,
  profileCompleteness,
  type RatingSummary,
  splitWorkshops,
} from '@vcraft/domain';
import type { LinkedImage, PublicLinkRole, PublicMedia } from '../media/application/media.service';

const toNumber = (value: string | null | undefined): number | null =>
  value === null || value === undefined ? null : Number(value);

/** The experience offer, present exactly when the workshop has a description for it (FR-ART-05). */
const toExperience = (w: Workshop): WorkshopDto['experience'] =>
  w.experienceDescription
    ? {
        description: w.experienceDescription,
        durationMinutes: w.experienceDurationMinutes ?? 0,
        priceVnd: w.experiencePriceVnd ?? 0,
      }
    : null;

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
    experience: toExperience(w),
    temporarilyClosed: w.temporarilyClosed,
    closureReason: w.closureReason ?? null,
    areaCode: w.areaCode ?? null,
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

/** A processed image of a media link: the URL it is served at plus every generated size. */
export interface CoverImage {
  url: string | null;
  variants: readonly MediaVariantResponse[];
}

/** Id ảnh tải lên của các sản phẩm, để tra URL một lần. */
export const productMediaIds = (products: readonly Product[]): string[] =>
  products.flatMap((p) => (p.images ?? []).map((image) => image.mediaId));

/**
 * Bìa là bìa riêng (dữ liệu mẫu) hoặc ảnh đầu tiên đã xử lý xong. A preset cover is a plain URL with
 * no variants; an uploaded photo brings the sizes of its media file.
 */
export function productCover(
  p: Product,
  media?: ReadonlyMap<string, PublicMedia>,
  linkedCovers: readonly CoverImage[] = [],
) {
  if (p.coverUrl) {
    // A cover that is a processed file of the product's `COVER` link brings that file's sizes; a preset
    // URL (static demo illustration) matches none and stays a single file.
    return {
      url: p.coverUrl,
      variants: variantsOfUrl(p.coverUrl, linkedCovers),
      alt: p.coverAlt ?? null,
      altEn: p.coverAltEn ?? null,
    };
  }
  const ready = (p.images ?? []).find((image) => media?.has(image.mediaId));
  const file = ready && media?.get(ready.mediaId);
  return ready && file
    ? { url: file.url, variants: file.variants, alt: ready.alt, altEn: null }
    : { url: null, variants: [], alt: null, altEn: null };
}

/** `makers` phải đã sắp theo `position` và nạp sẵn `artisan`. */
export function toProductDto(
  p: Product,
  makers: readonly ProductMaker[] = [],
  media?: ReadonlyMap<string, PublicMedia>,
  linkedCovers: readonly CoverImage[] = [],
): ProductDto {
  const cover = productCover(p, media, linkedCovers);
  return {
    id: p.id,
    version: p.version,
    name: p.name,
    nameEn: p.nameEn ?? null,
    slug: p.slug,
    traceCode: p.traceCode,
    description: p.description,
    descriptionEn: p.descriptionEn ?? null,
    kind: p.kind,
    batchSize: p.batchSize ?? null,
    category: p.category,
    priceVnd: p.priceVnd,
    stock: p.stock,
    material: p.material ?? null,
    dimensions: p.dimensions ?? null,
    materialEn: p.materialEn ?? null,
    dimensionsEn: p.dimensionsEn ?? null,
    weightGrams: p.weightGrams ?? null,
    artisanNote: p.artisanNote ?? null,
    tags: p.tags ?? [],
    coverUrl: cover.url,
    coverVariants: cover.variants,
    coverAlt: cover.alt,
    coverAltEn: cover.altEn,
    images: (p.images ?? []).map((image) => ({
      mediaId: image.mediaId,
      url: media?.get(image.mediaId)?.url ?? null,
      variants: media?.get(image.mediaId)?.variants ?? [],
      thumbhash: media?.get(image.mediaId)?.thumbhash ?? null,
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
    experience: isVisitable(w) ? toExperience(w) : null,
    temporarilyClosed: isVisitable(w) && w.temporarilyClosed,
    closureReason: isVisitable(w) && w.temporarilyClosed ? (w.closureReason ?? null) : null,
    lat: Number(w.lat),
    lng: Number(w.lng),
    household: {
      name: w.household.name,
      slug: w.household.slug,
      craft: w.household.craft ?? null,
      craftCategory: effectiveCraftCategory(w.household.craftCategory, w.household.craft),
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
  /** Ảnh công khai đã xử lý xong (URL và các cỡ), theo `mediaId`. */
  media?: ReadonlyMap<string, PublicMedia>;
  /** Portrait, banner and gallery images linked through `media_link`. */
  linked?: readonly LinkedImage[];
  /** Processed `COVER` images of the products, by `product.id`: the sizes behind each `coverVariants` (GH#252). */
  productCovers?: ReadonlyMap<string, readonly CoverImage[]>;
  /** Masked citizen ID number for the owner and admin views (never the full number). */
  idNumberMasked?: string | null;
  /** The buyers' rating summary (FR-ORD-11); absent means no ratings yet. */
  rating?: RatingSummary;
}

const linkedOf = (parts: HouseholdParts, role: PublicLinkRole) =>
  (parts.linked ?? []).filter((item) => item.role === role).map((item) => item.image);

/** Family milestones with their photo resolved to its processed URL, if any (FR-ART-02). */
function toTimelineDto(h: Household, parts: HouseholdParts) {
  return (h.timeline ?? []).map((event) => {
    const media = event.photo ? parts.media?.get(event.photo.mediaId) : undefined;
    return {
      year: event.year,
      title: event.title,
      text: event.text,
      photo: event.photo
        ? {
            mediaId: event.photo.mediaId,
            url: media?.url ?? null,
            variants: media?.variants ?? [],
            alt: event.photo.alt,
          }
        : null,
    };
  });
}

/** One of the household's own photos with its processed URL, or null URL while it is still processing. */
function toProfilePhoto(
  photo: HouseholdPhoto | null | undefined,
  parts: HouseholdParts,
): ProfilePhotoDto | null {
  if (!photo) return null;
  const media = parts.media?.get(photo.mediaId);
  return {
    mediaId: photo.mediaId,
    url: media?.url ?? null,
    variants: media?.variants ?? [],
    alt: photo.alt,
  };
}

/** The household's own photo as a public image; null until its processed file exists. */
function toOwnPublicImage(
  photo: HouseholdPhoto | null | undefined,
  parts: HouseholdParts,
): PublicImageDto | null {
  const own = toProfilePhoto(photo, parts);
  if (!own?.url) return null;
  return {
    mediaId: own.mediaId,
    url: own.url,
    width: null,
    height: null,
    variants: own.variants,
    alt: own.alt,
    altEn: null,
    caption: null,
    credit: null,
  };
}

/** Certifications with the photo resolved; `verified` is the board's mark and nothing else. */
function toCertificationsDto(h: Household, parts: HouseholdParts): CertificationDto[] {
  return (h.certifications ?? []).map((c) => ({
    name: c.name,
    issuer: c.issuer,
    year: c.year,
    issuedOn: c.issuedOn ?? null,
    photo: toProfilePhoto(c.photo, parts),
    verified: c.verified === true,
  }));
}

/** Images the household attached itself in Studio. */
function toGalleryDto(h: Household, parts: HouseholdParts) {
  return (h.gallery ?? []).map((item) => ({
    mediaId: item.mediaId ?? null,
    url: item.url ?? (item.mediaId ? (parts.media?.get(item.mediaId)?.url ?? null) : null),
    variants: item.mediaId ? (parts.media?.get(item.mediaId)?.variants ?? []) : [],
    alt: item.alt,
    altEn: null,
    caption: item.caption ?? null,
    credit: null,
  }));
}

/** Sizes of the image served at `url`, looked up among the household's processed images. */
export function variantsOfUrl(
  url: string | null,
  images: readonly { url: string | null; variants: readonly MediaVariantResponse[] }[],
): MediaVariantResponse[] {
  const match = url ? images.find((image) => image.url === url) : undefined;
  return match ? [...match.variants] : [];
}

export function toPublicHouseholdDto(h: Household, parts: HouseholdParts): PublicHouseholdDto {
  const linkedGallery = linkedOf(parts, 'GALLERY').map((image) => ({
    mediaId: image.mediaId,
    url: image.url,
    variants: image.variants,
    alt: image.alt,
    altEn: image.altEn,
    caption: image.caption,
    credit: image.credit,
  }));
  const gallery = [...linkedGallery, ...toGalleryDto(h, parts)];
  // The household's own uploads outrank the images the village board linked.
  const ownCover = toOwnPublicImage(h.coverPhoto, parts);
  const banner = ownCover ?? linkedOf(parts, 'BANNER')[0];
  const coverUrl =
    ownCover?.url ?? h.coverUrl ?? banner?.url ?? gallery.find((item) => item.url)?.url ?? null;
  return {
    id: h.id,
    name: h.name,
    slug: h.slug,
    history: h.history,
    village: h.village ?? null,
    craft: h.craft ?? null,
    craftCategory: effectiveCraftCategory(h.craftCategory, h.craft),
    // Chưa chọn bìa riêng thì dùng ảnh xưởng đầu tiên đã xử lý xong.
    coverUrl,
    coverVariants: variantsOfUrl(coverUrl, [...(banner ? [banner] : []), ...gallery]),
    ratingAverage: parts.rating?.average ?? null,
    ratingCount: parts.rating?.count ?? 0,
    portrait: toOwnPublicImage(h.portraitPhoto, parts) ?? linkedOf(parts, 'PORTRAIT')[0] ?? null,
    banner: banner ?? null,
    seal: toOwnPublicImage(h.sealPhoto, parts),
    foundedYear: h.foundedYear ?? null,
    generations: h.generations ?? null,
    timeline: toTimelineDto(h, parts),
    certifications: toCertificationsDto(h, parts),
    gallery,
    capacityByCategory: h.capacityByCategory ?? {},
    artisans: parts.artisans.map(toArtisanDto),
    workshops: parts.workshops.map(toWorkshopDto),
    visit: {
      showrooms: splitWorkshops(parts.workshops).showrooms.map(toWorkshopDto),
      productionWorkshops: splitWorkshops(parts.workshops).production.map(toWorkshopDto),
    },
    products: parts.products.map((p) =>
      toProductDto(p, parts.makers.get(p.id), parts.media, parts.productCovers?.get(p.id)),
    ),
  };
}

export function toHouseholdDto(h: Household, parts: HouseholdParts): HouseholdDto {
  return {
    ...toPublicHouseholdDto(h, parts),
    gallery: toGalleryDto(h, parts),
    version: h.version,
    status: h.status,
    statusReason: h.statusReason ?? null,
    reviewState: householdReviewState(h.status, h.statusReason, h.resubmittedAt),
    resubmittedAt: h.resubmittedAt?.toISOString() ?? null,
    approvedAt: h.approvedAt?.toISOString() ?? null,
    coverPhoto: toProfilePhoto(h.coverPhoto, parts),
    portraitPhoto: toProfilePhoto(h.portraitPhoto, parts),
    sealPhoto: toProfilePhoto(h.sealPhoto, parts),
    idNumberMasked: parts.idNumberMasked ?? null,
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
