import { JOURNAL_STAGES, type JournalStage } from '@vcraft/domain';
import { DEMO_QR_TRACE_CODE } from './accounts.js';

/**
 * Stage photos on the journal entries of the demo pieces (GH#472). The brief asks for proof photos at every
 * milestone; the team has no photos of one cup being made yet, so each stage shows a real, openly licensed photo of
 * that stage in a Bát Tràng workshop (credits in `photo-manifest.ts`, shown on `/ghi-nhan-anh`). They show the stage,
 * not the exact piece: the trace page labels every photo that has a credit as illustrative.
 *
 * The ids are `DEMO_PHOTOS` ids. `stage-*` photos were made for this; the others are photos already in the set whose
 * subject fits the stage (`ts-dat-set` raw clay, `news-got-bat` trimming a bowl on the wheel, `news-am-trang-moc`
 * unfired teapots, `news-trong-lo` ware set in a kiln, `tb-khay-men-mau` glazed trays, `lc-tui-chau` wrapped finished ware).
 */
export const JOURNAL_STAGE_PHOTOS: Readonly<Record<JournalStage, readonly string[]>> = {
  clay: ['ts-dat-set', 'stage-clay-2'],
  throw: ['news-got-bat', 'stage-throw-2'],
  dry: ['news-am-trang-moc', 'stage-dry-2'],
  paint: ['stage-paint-1', 'stage-paint-2'],
  glaze: ['stage-glaze-1', 'stage-glaze-2', 'stage-glaze-3'],
  fire: ['stage-fire-1', 'news-trong-lo'],
  finish: ['stage-finish-1', 'tb-khay-men-mau', 'lc-tui-chau'],
};

/** Every photo id the journal entries use (the manifest test reads this to know the photos are used). */
export const JOURNAL_PHOTO_IDS: readonly string[] = [
  ...new Set(Object.values(JOURNAL_STAGE_PHOTOS).flat()),
];

/**
 * Pieces outside the demo household that get stage photos too: the vase and the lotus bowl that stand in for the QR cup.
 * Every product of the demo household (Lò Đức Phát, the QR cup and the two drafts published live included) gets them as well.
 */
export const JOURNAL_PHOTO_EXTRA_TRACE_CODES: readonly string[] = ['BT7K2QXM', 'HX2M9KQD'];

/** The QR cup is the first thing an examiner scans: it shows two photos per stage where the stage has two. */
const PHOTOS_PER_STAGE_ON_QR_CUP = 2;

/**
 * The stage photos of one milestone: stable for a trace code and a stage (so a reseal never changes a hash), different
 * between pieces so the pieces do not all show the same picture. Always 1 to 3 photos (FR-PRD-04 allows 1 to 6).
 */
export function journalPhotoIds(traceCode: string, stage: JournalStage): string[] {
  const pool = JOURNAL_STAGE_PHOTOS[stage];
  let seed = JOURNAL_STAGES.indexOf(stage);
  for (const ch of traceCode) seed += ch.charCodeAt(0);
  const first = seed % pool.length;
  const count =
    traceCode === DEMO_QR_TRACE_CODE ? Math.min(PHOTOS_PER_STAGE_ON_QR_CUP, pool.length) : 1;
  return Array.from({ length: count }, (_, k) => pool[(first + k) % pool.length] as string);
}
