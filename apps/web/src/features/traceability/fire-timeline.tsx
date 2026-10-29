import { isJournalInProgress, missingStages } from '@vcraft/domain';
import { Badge } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import type { LogEntry } from '@/lib/demo/data';

/**
 * Dòng thời gian lửa (BRAND §6.3 #3): đường nối nóng dần từ màu đất sang màu lửa, mỗi mốc như
 * mảnh gốm ghép. Bản tĩnh; hiệu ứng "cháy" theo cuộn (GSAP + DrawSVG) thêm ở experience/.
 *
 * Mốc đính chính và mốc gốc cùng hiện, nối với nhau bằng liên kết (vCRAFT-9hg.4); nhật ký chưa có
 * công đoạn `finish` được ghi nhãn "đang làm" kèm tên các công đoạn chưa ghi.
 */
export async function FireTimeline({ entries }: { entries: readonly LogEntry[] }) {
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
      <ol className="relative">
        <span
          aria-hidden="true"
          className="absolute top-2 bottom-2 left-[0.9rem] w-0.5 rounded-full bg-linear-to-b from-ash/60 via-clay to-seal"
        />
        {entries.map((e, i) => (
          <li
            key={e.hash}
            id={`log-${i + 1}`}
            className="relative grid scroll-mt-6 grid-cols-[2rem_1fr] gap-4 rounded-card pb-10 last:pb-0 target:bg-seal/8 target:ring-2 target:ring-seal/50"
          >
            <span
              aria-hidden="true"
              className="relative z-10 mt-1 size-[1.85rem] rotate-45 rounded-[4px] border-2 border-paper shadow-warm"
              style={{ background: e.tint }}
            />
            <div>
              <p className="font-mono text-[0.75rem] tracking-wider text-ash">
                {String(i + 1).padStart(2, '0')} ·{' '}
                <time dateTime={e.at}>{format.dateTime(new Date(e.at), 'stamp')}</time>
              </p>
              <h3 className="mt-1 text-h3">{stages(`${e.stage}.name`)}</h3>
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
              <p className="mt-1 text-ink/85">{e.note}</p>
              {e.skipReason ? (
                <p className="mt-1 text-small text-ash">{t('skipped', { reason: e.skipReason })}</p>
              ) : null}
              <ImageSlot
                alt={t('proofAlt', { stage: stages(`${e.stage}.name`) })}
                tint={e.tint}
                ratio="3/2"
                className="mt-3 max-w-sm"
              />
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
    </>
  );
}
