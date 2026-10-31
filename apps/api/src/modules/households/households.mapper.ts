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
import { isVisitable, POSTED_BY_ADMINISTRATION, splitWorkshops } from '@vcraft/domain';

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

/** `makers` phải đã sắp theo `position` và nạp sẵn `artisan`. */
export function toProductDto(p: Product, makers: readonly ProductMaker[] = []): ProductDto {
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
    coverUrl: p.coverUrl ?? null,
    coverAlt: p.coverAlt ?? null,
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
}

export function toPublicHouseholdDto(h: Household, parts: HouseholdParts): PublicHouseholdDto {
  return {
    id: h.id,
    name: h.name,
    slug: h.slug,
    history: h.history,
    village: h.village ?? null,
    craft: h.craft ?? null,
    coverUrl: h.coverUrl ?? null,
    artisans: parts.artisans.map(toArtisanDto),
    workshops: parts.workshops.map(toWorkshopDto),
    visit: {
      showrooms: splitWorkshops(parts.workshops).showrooms.map(toWorkshopDto),
      productionWorkshops: splitWorkshops(parts.workshops).production.map(toWorkshopDto),
    },
    products: parts.products.map((p) => toProductDto(p, parts.makers.get(p.id))),
  };
}

export function toHouseholdDto(h: Household, parts: HouseholdParts): HouseholdDto {
  return {
    ...toPublicHouseholdDto(h, parts),
    version: h.version,
    status: h.status,
    statusReason: h.statusReason ?? null,
    approvedAt: h.approvedAt?.toISOString() ?? null,
  };
}
