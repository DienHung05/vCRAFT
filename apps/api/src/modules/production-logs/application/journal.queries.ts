import type { EntityManager } from '@mikro-orm/core';
import type { JournalDto, JournalEntryDto } from '@vcraft/contracts';
import { JournalEntry, MediaAsset, type MediaCredit, type Product } from '@vcraft/database';
import { type ChainEntry, isJournalInProgress, missingStages } from '@vcraft/domain';

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

/** Ghi nguồn của ảnh mốc, theo `sha256`: mốc chỉ lưu URL và dấu băm của ảnh, không lưu id tệp. */
async function loadCredits(
  em: EntityManager,
  entries: readonly JournalEntry[],
): Promise<Map<string, MediaCredit>> {
  const checksums = [...new Set(entries.flatMap((e) => e.images.map((image) => image.sha256)))];
  const credits = new Map<string, MediaCredit>();
  if (checksums.length === 0) return credits;
  const assets = await em.find(MediaAsset, {
    sha256: { $in: checksums },
    status: 'READY',
    visibility: 'PUBLIC',
  });
  for (const asset of assets) {
    if (asset.credit) credits.set(asset.sha256, asset.credit);
  }
  return credits;
}

export async function toJournalDto(
  em: EntityManager,
  product: Product,
  entries: readonly JournalEntry[],
): Promise<JournalDto> {
  const credits = await loadCredits(em, entries);
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
        images: e.images.map((image) => ({
          ...image,
          credit: credits.get(image.sha256) ?? null,
        })),
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

export async function loadJournal(em: EntityManager, product: Product): Promise<JournalDto> {
  return toJournalDto(em, product, await loadEntries(em, product));
}
