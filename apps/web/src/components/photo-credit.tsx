import { getTranslations } from 'next-intl/server';
import { PHOTO_BY_ID } from '@/lib/demo/photo-credits';

/**
 * Dòng ghi nguồn dưới ảnh có giấy phép CC (CC BY / BY-SA bắt buộc ghi tác giả và giấy phép).
 * Không vẽ gì khi ảnh không có trong bảng ghi nhận (ảnh giữ chỗ).
 */
export async function PhotoCredit({ id, className }: { id: string; className?: string }) {
  const credit = PHOTO_BY_ID.get(id);
  if (!credit) return null;
  const t = await getTranslations('credits');
  return (
    <p className={className ?? 'mt-1.5 text-[0.75rem] leading-snug text-ash'}>
      {t('photoBy', { author: credit.author })}
      {' · '}
      <a
        href={credit.licenseUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-ink"
      >
        {credit.license}
      </a>
      {' · '}
      <a
        href={credit.sourceUrl}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-2 hover:text-ink"
      >
        {t('source')}
      </a>
    </p>
  );
}
