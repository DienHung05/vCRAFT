import type { MediaCreditDto } from '@vcraft/contracts';
import { useTranslations } from 'next-intl';
import { PHOTO_BY_ID } from '@/lib/demo/photo-credits';

export interface PhotoCreditProps {
  /** Image in the web app's static set: the credit is looked up by id. */
  id?: string | undefined;
  /** Credit returned by the API for an image in the media store; takes priority over `id`. */
  credit?: MediaCreditDto | null | undefined;
  className?: string;
}

/**
 * Credit line under a CC-licensed image (CC BY / BY-SA require naming the author and licence).
 * Renders nothing when the image has no credit (placeholders, photos taken by the household).
 */
export function PhotoCredit({ id, credit, className }: PhotoCreditProps) {
  const t = useTranslations('credits');
  const source = credit ?? (id ? PHOTO_BY_ID.get(id) : undefined);
  if (!source) return null;
  return (
    <p className={className ?? 'mt-1.5 text-[0.75rem] leading-snug text-ash'}>
      {t('photoBy', { author: source.author })}
      {' · '}
      <a
        href={source.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-ink"
      >
        {source.license}
      </a>
      {' · '}
      <a
        href={source.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-ink"
      >
        {t('source')}
      </a>
    </p>
  );
}
