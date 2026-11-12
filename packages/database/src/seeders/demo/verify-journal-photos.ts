import type { EntityManager } from '@mikro-orm/core';
import { JournalEntry, MediaAsset, Product } from '../../entities/index.js';
import { DEMO_HOUSEHOLD_IDS, DEMO_QR_TRACE_CODE } from './accounts.js';
import { JOURNAL_PHOTO_EXTRA_TRACE_CODES } from './journal-photos.js';

type AddCheck = (name: string, ok: boolean, detail: string) => void;

/**
 * Proof photos on the journal of the demo pieces (GH#472): every milestone of the pieces the demo shows (the QR cup,
 * the vase and the lotus bowl, and every product of the demo household, drafts included) carries at least one photo,
 * and each photo is a published (`READY`, public) file of the media store, so the trace page can show it.
 * Read-only. Run after `pnpm demo:media`; the chain check of `verify.ts` already covers the checksums in the hashes.
 */
export async function verifyJournalPhotos(em: EntityManager, add: AddCheck): Promise<void> {
  const products = await em.find(
    Product,
    {
      $or: [
        { household: DEMO_HOUSEHOLD_IDS.household },
        { traceCode: { $in: [DEMO_QR_TRACE_CODE, ...JOURNAL_PHOTO_EXTRA_TRACE_CODES] } },
      ],
    },
    { fields: ['id', 'traceCode'] },
  );
  const codeOf = new Map(products.map((p) => [p.id, p.traceCode]));
  const entries =
    products.length === 0
      ? []
      : await em.find(JournalEntry, { product: { $in: [...codeOf.keys()] } });
  const shas = new Set(entries.flatMap((e) => e.images.map((image) => image.sha256)));
  const ready = new Set(
    (
      await em.find(
        MediaAsset,
        { sha256: { $in: [...shas] }, status: 'READY', visibility: 'PUBLIC' },
        { fields: ['sha256'] },
      )
    ).map((a) => a.sha256),
  );
  const bare = new Set<string>();
  const unpublished = new Set<string>();
  for (const entry of entries) {
    const code = codeOf.get(entry.product.id) as string;
    if (entry.images.length === 0) bare.add(code);
    else if (entry.images.some((image) => !ready.has(image.sha256))) unpublished.add(code);
  }
  const bad = [...new Set([...bare, ...unpublished])];
  add(
    'Nhật ký của các món demo: mọi mốc có ít nhất một ảnh công khai (READY)',
    products.length > 0 && entries.length > 0 && bad.length === 0,
    bad.length === 0
      ? `${products.length} sản phẩm, ${entries.length} mốc đều có ảnh`
      : `thiếu ảnh ở ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}; chạy pnpm demo:media`,
  );
}
