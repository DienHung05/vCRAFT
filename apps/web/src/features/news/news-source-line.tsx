import type { NewsSummaryDto } from '@vcraft/contracts';
import { useFormatter, useTranslations } from 'next-intl';

type SourceFields = Pick<NewsSummaryDto, 'sourceName' | 'sourceUrl' | 'sourcePublishedAt'>;

/**
 * "Nguồn: <publisher>, <date>" linking to the original story (GH#314). Renders nothing without a
 * publisher, and shows plain text when the item has a name but no link. Origin is never shown here.
 */
export function NewsSourceLine({
  item,
  className = 'text-small text-ash',
}: {
  item: SourceFields;
  className?: string;
}) {
  const t = useTranslations('indexPages.news');
  const format = useFormatter();
  if (!item.sourceName) return null;
  const label = item.sourcePublishedAt
    ? t('sourceLine', {
        name: item.sourceName,
        date: format.dateTime(new Date(item.sourcePublishedAt), 'long'),
      })
    : t('sourceLineNoDate', { name: item.sourceName });
  return (
    <p className={className} data-testid="news-source">
      {item.sourceUrl ? (
        <a
          href={item.sourceUrl}
          target="_blank"
          rel="noopener nofollow"
          className="break-words text-clay underline underline-offset-4"
        >
          {label}
        </a>
      ) : (
        label
      )}
    </p>
  );
}
