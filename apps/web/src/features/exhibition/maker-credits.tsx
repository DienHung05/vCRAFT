import { cn } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { vietnameseOnlyLang } from '@/lib/vietnamese-text';

export interface MakerCreditItem {
  name: string;
  /** Phần việc (với sản phẩm) hoặc vai trò trong hộ. */
  detail: string;
}

export interface MakerCreditsProps {
  makers: readonly MakerCreditItem[];
  household: string;
  /** Mức tiêu đề: trang hộ dùng h2, trang QR cũng h2 nhưng gọn hơn. */
  compact?: boolean;
  className?: string;
}

/**
 * Ghi công người làm (vCRAFT-9hg.6): tên từng người kèm phần việc. Người đăng bài được nêu là ban
 * điều hành hộ, tách hẳn khỏi danh sách người làm.
 */
export function MakerCredits({ makers, household, compact, className }: MakerCreditsProps) {
  const t = useTranslations('exhibition');
  // Contributions are written by the household in Vietnamese only (GH#482).
  const detailLang = vietnameseOnlyLang(useLocale());
  return (
    <section aria-labelledby="makers-title" className={className}>
      <h2 id="makers-title" className={cn(compact && 'text-h3')}>
        {t('makersTitle')}
      </h2>
      <p className="mt-2 text-small text-ash">{t('makersLead')}</p>
      <ul aria-label={t('madeBy')} className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {makers.map((m) => (
          <li key={m.name} className="rounded-card border border-ink/10 bg-surface p-5">
            <p className="font-display text-h3 text-ink">{m.name}</p>
            <p className="mt-1 text-small text-ash" lang={detailLang}>
              {m.detail}
            </p>
          </li>
        ))}
      </ul>
      <p className="mt-4 text-small text-ink/85" data-posted-by="household-administration">
        {t('postedBy', { household })}
      </p>
    </section>
  );
}
