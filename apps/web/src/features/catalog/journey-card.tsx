import { buttonVariants, Card, cn } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { StageIcon } from '@/features/traceability/stage-icon';
import { Link } from '@/i18n/navigation';
import { JourneyReveal } from './journey-reveal';
import type { LogEntryView } from './view-models';

/**
 * The "journey" card of the product page (GH#300): one dot per journal entry, each with a small stage icon and
 * the stage name shown on hover and keyboard focus. A dot links to that step on the trace page. The dots fill in
 * one after the other when the card scrolls into view (see `JourneyReveal`).
 */
export async function JourneyCard({
  entries,
  traceCode,
}: {
  /** The journal in order; the card is not shown for an empty journal. */
  entries: readonly LogEntryView[];
  traceCode: string;
}) {
  const [t, stages, format] = await Promise.all([
    getTranslations('product'),
    getTranslations('stages'),
    getFormatter(),
  ]);
  const first = entries[0];
  const last = entries.at(-1);
  if (!first || !last) return null;
  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-sans text-body font-semibold text-ink">{t('journey')}</h2>
        <span className="font-mono text-small text-ash">{traceCode}</span>
      </div>
      <JourneyReveal label={t('journey')}>
        {entries.map((e, i) => (
          <li
            key={e.hash}
            className="flex flex-1 items-center last:flex-none"
            style={{ '--i': i } as React.CSSProperties}
          >
            <Link
              href={{
                pathname: '/truy-xuat/[code]',
                params: { code: traceCode },
                hash: `log-${e.seq + 1}`,
              }}
              className="journey-dot journey-mark"
              style={{
                background: e.tint,
                color: e.stage === 'dry' ? 'var(--color-ink)' : 'var(--color-paper)',
              }}
            >
              <StageIcon stage={e.stage} size={14} />
              <span className="journey-dot-label">{stages(`${e.stage}.name`)}</span>
            </Link>
            {i < entries.length - 1 ? (
              <span
                aria-hidden="true"
                className="journey-link h-0.5 flex-1 bg-linear-to-r from-clay/50 to-seal/50"
              />
            ) : null}
          </li>
        ))}
      </JourneyReveal>
      <p className="text-small text-ash">
        {t('journeySummary', {
          count: entries.length,
          from: format.dateTime(new Date(first.at), 'short'),
          to: format.dateTime(new Date(last.at), 'short'),
        })}
      </p>
      <Link
        href={{ pathname: '/truy-xuat/[code]', params: { code: traceCode } }}
        className={cn(
          buttonVariants({ variant: 'ghost', size: 'sm' }),
          'self-start px-0 text-clay hover:bg-transparent hover:underline',
        )}
      >
        {t('journeyCta')} →
      </Link>
    </Card>
  );
}
