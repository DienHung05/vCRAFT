import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { RetryLink } from '@/components/retry-link';
import { fetchMapPins } from '@/features/village-map/map-model';
import { VillageMapExplorer } from '@/features/village-map/village-map-explorer';
import { resolveLocale } from '@/lib/locale';

// Ghim lấy từ API lúc có yêu cầu (không dựng tĩnh lúc build, khi API có thể chưa chạy).
export const dynamic = 'force-dynamic';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ban-do'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('villageMap');
  return { title: t('title'), description: t('lead') };
}

/** Bản đồ làng nghề (FR-MAP): ghim của mọi xưởng đã duyệt, luôn kèm danh sách chữ. */
export default async function VillageMapPage({ params }: PageProps<'/[locale]/ban-do'>) {
  await resolveLocale(params);
  const [t, result] = await Promise.all([getTranslations('villageMap'), fetchMapPins()]);

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      {result.status === 'ok' ? (
        <VillageMapExplorer pins={result.pins} />
      ) : (
        <div role="alert" className="mt-8 flex flex-col items-start gap-3">
          <p className="text-ash">{t('unavailable')}</p>
          <RetryLink />
        </div>
      )}
    </div>
  );
}
