import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

/** Một dòng ghi nguồn chung cho nhóm ảnh nhỏ (lưới thẻ, dải công đoạn) không đủ chỗ ghi từng ảnh. */
export async function PhotoCreditsNote({ className }: { className?: string }) {
  const t = await getTranslations('credits');
  return (
    <p className={className ?? 'mt-4 text-[0.75rem] leading-snug text-ash'}>
      {t('note')}{' '}
      <Link href="/ghi-nhan-anh" className="underline underline-offset-2 hover:text-ink">
        {t('noteLink')}
      </Link>
    </p>
  );
}
