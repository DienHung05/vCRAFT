import type { EntityManager } from '@mikro-orm/core';
import type { JournalDto, JournalEntryDto } from '@vcraft/contracts';
import { JournalEntry, type Product } from '@vcraft/database';
import { type ChainEntry, isJournalInProgress, missingStages } from '@vcraft/domain';
import type { MediaService } from '../../media/application/media.service';

/** Mốc đã lưu → đầu vào của chuỗi băm (cùng thuật toán với trình duyệt). */
export function toChainEntry(entry: JournalEntry): ChainEntry {
  return {
    seq: entry.seq,
    stage: entry.stage,
    at: entry.declaredDate,
    note: entry.note,
    mediaChecksums: entry.images.map((image) => image.sha256),
    supersedesSeq: entry.supersedes?.seq,
    skipReason: entry.skipReason ?? undefined,
    prevHash: entry.prevHash,
    hash: entry.hash,
  };
}

/** Các mốc của sản phẩm theo `seq`, kèm mốc bị đính chính đã nạp. */
export function loadEntries(em: EntityManager, product: Product): Promise<JournalEntry[]> {
  return em.find(JournalEntry, { product }, { orderBy: { seq: 'asc' }, populate: ['supersedes'] });
}

export async function toJournalDto(
  product: Product,
  entries: readonly JournalEntry[],
  media: MediaService,
): Promise<JournalDto> {
  const images = await media.entryImages(
    entries.flatMap((e) => e.images.map((image) => image.sha256)),
  );
  const supersededBy = new Map<number, number>();
  for (const entry of entries) {
    if (entry.supersedes) supersededBy.set(entry.supersedes.seq, entry.seq);
  }
  const facts = entries.map((e) => ({ seq: e.seq, stage: e.stage }));
  return {
    productId: product.id,
    entries: entries.map(
      (e): JournalEntryDto => ({
        id: e.id,
        version: e.version,
        seq: e.seq,
        stage: e.stage,
        declaredDate: e.declaredDate,
        note: e.note,
        images: e.images.map((image) => {
          const media = images.get(image.sha256);
          return {
            // A stored URL (older entries) keeps working; newer entries resolve it once the photo is READY.
            url: image.url ?? media?.url ?? null,
            sha256: image.sha256,
            credit: media?.credit ?? null,
            variants: media?.variants ?? [],
            mediaId: media?.mediaId ?? null,
            status: media?.status ?? 'READY',
            thumbhash: media?.thumbhash ?? null,
          };
        }),
        skipReason: e.skipReason ?? null,
        supersedesSeq: e.supersedes?.seq ?? null,
        supersededBySeq: supersededBy.get(e.seq) ?? null,
        recordedAt: e.createdAt.toISOString(),
        prevHash: e.prevHash,
        hash: e.hash,
      }),
    ),
    inProgress: isJournalInProgress(facts),
    missingStages: missingStages(facts),
  };
}

export async function loadJournal(
  em: EntityManager,
  product: Product,
  media: MediaService,
): Promise<JournalDto> {
  return toJournalDto(product, await loadEntries(em, product), media);
}
