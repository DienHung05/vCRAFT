import { isJournalInProgress, missingStages } from '@vcraft/domain';
import { Badge } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { type LogEntryView, photoFromUrl, slotPhoto } from '@/features/catalog/view-models';
import { formatDeclaredDate } from '@/lib/declared-date';
import { vietnameseOnlyLang } from '@/lib/vietnamese-text';
import { FireStory } from './fire-story';
import { PieceFigure } from './piece-figure';
import type { PieceKind } from './piece-shapes';

/**
 * Dòng thời gian lửa (BRAND §6.3 #3): đường nối nóng dần từ màu đất sang màu lửa, mỗi mốc như
 * mảnh gốm ghép. Bản tĩnh là danh sách đọc được kèm hình minh họa cuối cùng; với `pieceKind`, màn rộng cho
 * phép chuyển động cuộn từng mốc (GH#300): đường nối "nóng" dần và hình món gốm thành hình theo từng công đoạn.
 *
 * Mốc đính chính và mốc gốc cùng hiện, nối với nhau bằng liên kết (vCRAFT-9hg.4); nhật ký chưa có
 * công đoạn `finish` được ghi nhãn "đang làm" kèm tên các công đoạn chưa ghi; công đoạn không có mốc thì không nhắc tới.
 */
export async function FireTimeline({
  entries,
  newestFirst = false,
  household,
  pieceKind,
  glaze = 'var(--color-glaze)',
  locale = 'vi',
}: {
  entries: readonly LogEntryView[];
  /** The household that kept the journal, shown on each step as who recorded it. */
  household?: string;
  /** Shape of the illustration of the piece taking shape; without it the plain list shows. */
  pieceKind?: PieceKind;
  /** Glaze colour of the finished piece in the illustration. */
  glaze?: string;
  /** Trang QR (biến thể C) đọc từ mốc mới nhất ngược về; số thứ tự và neo `#log-N` vẫn theo `seq`. */
  newestFirst?: boolean;
  /** Page locale: households write notes in Vietnamese only, so on `/en` they carry `lang="vi"` (GH#482). */
  locale?: string;
}) {
  const [stages, t, format] = await Promise.all([
    getTranslations('stages'),
    getTranslations('trace'),
    getFormatter(),
  ]);
  const correctedBy = new Map<number, number>();
  for (const e of entries) {
    if (e.supersedesSeq !== undefined) correctedBy.set(e.supersedesSeq, e.seq);
  }
  const inProgress = entries.length > 0 && isJournalInProgress(entries);
  // The story reads oldest first; the newest-first order of the QR variant stays a plain list.
  const storyKind = newestFirst || entries.length === 0 ? undefined : pieceKind;
  const list = (
    <ol className="relative" data-fire-steps="">
      <span
        aria-hidden="true"
        className="fire-line absolute top-2 bottom-2 left-[0.9rem] w-0.5 rounded-full bg-linear-to-b from-ash/60 via-clay to-seal"
      />
      <span aria-hidden="true" data-fire-heat="" className="fire-heat" />
      {(newestFirst ? [...entries].reverse() : entries).map((e) => (
        <li
          key={e.hash}
          id={`log-${e.seq + 1}`}
          data-fire-step=""
          className="fire-step relative grid scroll-mt-6 grid-cols-[2rem_minmax(0,1fr)] gap-4 rounded-card pb-10 last:pb-0 target:bg-seal/8 target:ring-2 target:ring-seal/50"
        >
          <span
            aria-hidden="true"
            className="fire-mark relative z-10 mt-1 size-[1.85rem] rotate-45 rounded-[4px] border-2 border-paper shadow-warm"
            style={{ background: e.tint }}
          />
          <div>
            <p className="font-mono text-[0.75rem] tracking-wider text-ash">
              {String(e.seq + 1).padStart(2, '0')} ·{' '}
              <time dateTime={e.at}>{formatDeclaredDate(format, e.at)}</time>
            </p>
            <h3 className="mt-1 text-h3">
              <a
                href={`#log-${e.seq + 1}`}
                className="underline-offset-4 hover:underline focus-visible:underline"
              >
                {stages(`${e.stage}.name`)}
              </a>
            </h3>
            {household ? (
              <p className="mt-1 break-words text-small text-ash">
                {t('recordedBy', { household })}
              </p>
            ) : null}
            {e.supersedesSeq !== undefined ? (
              <p className="mt-1 text-small font-medium text-seal">
                <a href={`#log-${e.supersedesSeq + 1}`} className="underline underline-offset-2">
                  {t('corrects', { n: e.supersedesSeq + 1 })}
                </a>
              </p>
            ) : null}
            {correctedBy.has(e.seq) ? (
              <p className="mt-1 text-small text-ash">
                <a
                  href={`#log-${(correctedBy.get(e.seq) ?? 0) + 1}`}
                  className="underline underline-offset-2"
                >
                  {t('correctedBy', { n: (correctedBy.get(e.seq) ?? 0) + 1 })}
                </a>
              </p>
            ) : null}
            <p className="mt-1 break-words text-ink/85" lang={vietnameseOnlyLang(locale)}>
              {e.note}
            </p>
            {e.skipReason ? (
              <p className="mt-1 break-words text-small text-ash">
                {t.rich('skipped', {
                  reason: e.skipReason ?? '',
                  note: (chunks) => <span lang={vietnameseOnlyLang(locale)}>{chunks}</span>,
                })}
              </p>
            ) : null}
            {/* A photo still processing has no URL yet: nothing is shown until it is ready. */}
            {e.images
              .filter((image) => image.url)
              .map((image) => {
                // A photo with a credit is someone else's picture of the stage (GH#472), never of this piece: say so
                // under it and describe what it shows. A household's own upload has no credit and no note.
                const { credit } = image;
                const stage = stages(`${e.stage}.name`);
                const alt =
                  locale === 'vi' && image.alt
                    ? image.alt
                    : t(credit ? 'stagePhotoAlt' : 'proofAlt', { stage });
                const photo = photoFromUrl(image.url, alt, image.variants);
                return (
                  <figure key={image.sha256} className="mt-3 max-w-sm">
                    <ImageSlot
                      alt={alt}
                      tint={e.tint}
                      ratio="3/2"
                      {...slotPhoto(photo)}
                      thumbhash={image.thumbhash}
                      sizes="(min-width: 640px) 24rem, 100vw"
                    />
                    {credit ? (
                      <figcaption className="mt-1.5 text-small text-ash" data-stage-photo-note="">
                        {t('stagePhotoNote')} {t('photoBy')}{' '}
                        <a
                          href={credit.sourceUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-clay"
                        >
                          {credit.author}
                        </a>{' '}
                        ·{' '}
                        <a
                          href={credit.licenseUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="underline underline-offset-2 hover:text-clay"
                        >
                          {credit.license}
                        </a>
                      </figcaption>
                    ) : null}
                  </figure>
                );
              })}
            {/* Hiển thị rút gọn cho gọn mắt; dấu băm đầy đủ 64 hex nằm ở `title`. */}
            <p
              className="mt-2 font-mono text-[0.7rem] text-ash"
              title={`${t('hashHint')} ${e.hash}`}
            >
              # {e.hash.slice(0, 10)}…{e.hash.slice(-6)}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
  return (
    <>
      {inProgress ? (
        <p className="mb-6">
          <Badge tone="outline">
            {t('inProgress', {
              stages: missingStages(entries)
                .map((stage) => stages(`${stage}.name`))
                .join(', '),
            })}
          </Badge>
        </p>
      ) : null}
      {entries.length === 0 ? <p className="text-ash">{t('emptyJournal')}</p> : null}
      {storyKind ? (
        <FireStory
          figure={<PieceFigure kind={storyKind} glaze={glaze} />}
          stages={entries.map((e) => e.stage)}
        >
          {list}
        </FireStory>
      ) : (
        list
      )}
    </>
  );
}
