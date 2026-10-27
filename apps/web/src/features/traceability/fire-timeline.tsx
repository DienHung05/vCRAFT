import { getFormatter, getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import type { LogEntry } from '@/lib/demo/data';

/**
 * Dòng thời gian lửa (BRAND §6.3 #3): đường nối nóng dần từ màu đất sang màu lửa, mỗi mốc như
 * mảnh gốm ghép. Bản tĩnh; hiệu ứng "cháy" theo cuộn (GSAP + DrawSVG) thêm ở experience/.
 */
export async function FireTimeline({ entries }: { entries: readonly LogEntry[] }) {
  const [stages, t, format] = await Promise.all([
    getTranslations('stages'),
    getTranslations('trace'),
    getFormatter(),
  ]);
  return (
    <ol className="relative">
      <span
        aria-hidden="true"
        className="absolute top-2 bottom-2 left-[0.9rem] w-0.5 rounded-full bg-linear-to-b from-ash/60 via-clay to-seal"
      />
      {entries.map((e, i) => (
        <li key={e.hash} className="relative grid grid-cols-[2rem_1fr] gap-4 pb-10 last:pb-0">
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
            <p className="mt-1 text-ink/85">{e.note}</p>
            <ImageSlot
              alt={t('proofAlt', { stage: stages(`${e.stage}.name`) })}
              tint={e.tint}
              ratio="3/2"
              className="mt-3 max-w-sm"
            />
            <p className="mt-2 font-mono text-[0.7rem] text-ash" title={t('hashHint')}>
              # {e.hash}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
