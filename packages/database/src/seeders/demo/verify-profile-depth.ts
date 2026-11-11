import type { EntityManager } from '@mikro-orm/core';
import { isVisitable, profileCompleteness } from '@vcraft/domain';
import { Household, MediaAsset, Product, Workshop } from '../../entities/index.js';
import { DEMO_HOUSEHOLD_IDS, DEMO_QR_TRACE_CODE } from './accounts.js';

type AddCheck = (name: string, ok: boolean, detail: string) => void;

/** Visitable workshops with an experience offer the map filter "Có trải nghiệm" must list (GH#473). */
export const MIN_EXPERIENCE_WORKSHOPS = 5;
/** Photos the product page gallery of the demo product shows. */
export const MIN_PRODUCT_GALLERY_IMAGES = 3;

/**
 * Profile depth of the demo data (GH#473): timeline and certification on every approved household, experience
 * offers, the gallery of the demo product and the full profile of Lò Đức Phát. Read-only. With `media`, also checks
 * that every photo the profiles point at has a READY public file (after `pnpm demo:media`).
 */
export async function verifyProfileDepth(
  em: EntityManager,
  add: AddCheck,
  options: { media: boolean },
): Promise<void> {
  const approved = await em.find(Household, { status: 'APPROVED' }, { orderBy: { name: 'asc' } });
  const bare = approved.filter(
    (h) => (h.timeline?.length ?? 0) < 1 || (h.certifications?.length ?? 0) < 1,
  );
  add(
    'Hộ đã duyệt: mỗi hộ có ≥ 1 mốc dòng thời gian và ≥ 1 chứng nhận',
    approved.length > 0 && bare.length === 0,
    bare.length === 0
      ? `${approved.length} hộ đủ`
      : `thiếu ở ${bare
          .slice(0, 3)
          .map((h) => h.name)
          .join(', ')}`,
  );

  const workshops = await em.find(Workshop, { experienceDescription: { $ne: null } });
  const offering = workshops.filter((w) => isVisitable(w));
  add(
    `Xưởng đón khách có trải nghiệm: ≥ ${MIN_EXPERIENCE_WORKSHOPS}`,
    offering.length >= MIN_EXPERIENCE_WORKSHOPS &&
      offering.every((w) => (w.experienceDurationMinutes ?? 0) > 0 && w.experiencePriceVnd != null),
    `${offering.length} xưởng`,
  );

  const qr = await em.findOne(Product, { traceCode: DEMO_QR_TRACE_CODE });
  const gallery = qr?.images ?? [];
  add(
    `Sản phẩm ${DEMO_QR_TRACE_CODE}: thư viện ≥ ${MIN_PRODUCT_GALLERY_IMAGES} ảnh`,
    gallery.length >= MIN_PRODUCT_GALLERY_IMAGES,
    `${gallery.length} ảnh`,
  );

  const phat = await em.findOne(Household, DEMO_HOUSEHOLD_IDS.household);
  const phatWorkshops = phat ? await em.find(Workshop, { household: phat }) : [];
  const completeness = phat
    ? profileCompleteness({
        history: phat.history,
        foundedYear: phat.foundedYear ?? null,
        generations: phat.generations ?? null,
        timelineCount: phat.timeline?.length ?? 0,
        certificationCount: phat.certifications?.length ?? 0,
        galleryCount: phat.gallery?.length ?? 0,
        workshopHasLocation: phatWorkshops.some((w) => w.lat != null && w.lng != null),
        workshopHasHours: phatWorkshops.some((w) => (w.openingHours?.length ?? 0) > 0),
        capacityCategories: Object.keys(phat.capacityByCategory ?? {}).length,
      })
    : { percent: 0, missing: ['household'] };
  const certifications = phat?.certifications ?? [];
  add(
    'Lò Đức Phát: hồ sơ 100%, 2 chứng nhận (1 đã xác nhận), có con dấu',
    completeness.percent === 100 &&
      certifications.length === 2 &&
      certifications.filter((c) => c.verified).length === 1 &&
      Boolean(phat?.sealPhoto),
    `${completeness.percent}%${completeness.missing.length ? `, thiếu ${completeness.missing.join(', ')}` : ''}`,
  );

  if (!options.media) return;
  const products = await em.find(
    Product,
    { household: DEMO_HOUSEHOLD_IDS.household },
    { fields: ['id', 'images'] },
  );
  const ids = [
    ...(phat?.sealPhoto ? [phat.sealPhoto.mediaId] : []),
    ...(phat?.gallery ?? []).flatMap((g) => (g.mediaId ? [g.mediaId] : [])),
    ...products.flatMap((p) => (p.images ?? []).map((i) => i.mediaId)),
  ];
  const unique = [...new Set(ids)];
  const ready = await em.count(MediaAsset, {
    id: { $in: unique },
    status: 'READY',
    visibility: 'PUBLIC',
  });
  add(
    'Ảnh của hồ sơ Lò Đức Phát (con dấu, thư viện, sản phẩm) đều đã READY',
    unique.length > 0 && ready === unique.length,
    `${ready}/${unique.length} tệp; chạy pnpm demo:media nếu thiếu`,
  );
}
