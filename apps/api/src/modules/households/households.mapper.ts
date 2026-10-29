import type {
  ArtisanDto,
  HouseholdDto,
  ProductDto,
  PublicHouseholdDto,
  WorkshopDto,
} from '@vcraft/contracts';
import type { Artisan, Household, Product, Workshop } from '@vcraft/database';

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

export function toProductDto(p: Product): ProductDto {
  return {
    id: p.id,
    version: p.version,
    name: p.name,
    slug: p.slug,
    traceCode: p.traceCode,
    description: p.description,
    kind: p.kind,
    batchSize: p.batchSize ?? null,
    status: p.status,
    publishedAt: p.publishedAt?.toISOString() ?? null,
  };
}

export interface HouseholdParts {
  artisans: Artisan[];
  workshops: Workshop[];
  products: Product[];
}

export function toPublicHouseholdDto(h: Household, parts: HouseholdParts): PublicHouseholdDto {
  return {
    id: h.id,
    name: h.name,
    slug: h.slug,
    history: h.history,
    village: h.village ?? null,
    artisans: parts.artisans.map(toArtisanDto),
    workshops: parts.workshops.map(toWorkshopDto),
    products: parts.products.map(toProductDto),
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
