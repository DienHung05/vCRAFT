import type { MediaCreditDto } from '@vcraft/contracts';
import { useTranslations } from 'next-intl';
import { PHOTO_BY_ID } from '@/lib/demo/photo-credits';

export interface PhotoCreditProps {
  /** Ảnh trong bộ ảnh tĩnh của web: tra ghi nguồn theo id. */
  id?: string | undefined;
  /** Ghi nguồn API trả về cho ảnh trong kho media; được ưu tiên hơn `id`. */
  credit?: MediaCreditDto | null | undefined;
  className?: string;
}

/**
 * Dòng ghi nguồn dưới ảnh có giấy phép CC (CC BY / BY-SA bắt buộc ghi tác giả và giấy phép).
 * Không vẽ gì khi ảnh không có ghi nguồn (ảnh giữ chỗ, ảnh do hộ tự chụp).
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
