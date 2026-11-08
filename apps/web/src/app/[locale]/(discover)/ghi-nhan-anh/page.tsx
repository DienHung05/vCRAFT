import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { PHOTO_CREDITS } from '@/lib/demo/photo-credits';
import { resolveLocale } from '@/lib/locale';

export async function generateMetadata({
  params,
}: PageProps<'/[locale]/ghi-nhan-anh'>): Promise<Metadata> {
  await resolveLocale(params);
  const t = await getTranslations('credits');
  return { title: t('title'), description: t('lead') };
}

/** Nhiều ảnh được cắt khác tỉ lệ từ cùng một file nguồn: liệt kê mỗi file một lần. */
const UNIQUE_CREDITS = [...new Map(PHOTO_CREDITS.map((c) => [c.title, c])).values()];

/** Ghi nhận tác giả và giấy phép của ảnh minh hoạ (CC BY / CC BY-SA yêu cầu ghi nguồn). */
export default async function ImageCreditsPage({ params }: PageProps<'/[locale]/ghi-nhan-anh'>) {
  await resolveLocale(params);
  const t = await getTranslations('credits');

  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-section">
      <header className="flex max-w-prose-vn flex-col gap-3">
        <h1 className="text-h1">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      <div className="mt-10 overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-left text-small">
          <caption className="sr-only">{t('table')}</caption>
          <thead>
            <tr className="border-ink/15 border-b text-ash">
              <th scope="col" className="py-2 pr-4 font-medium">
                {t('colPhoto')}
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                {t('colAuthor')}
              </th>
              <th scope="col" className="py-2 pr-4 font-medium">
                {t('colLicense')}
              </th>
              <th scope="col" className="py-2 font-medium">
                {t('colSource')}
              </th>
            </tr>
          </thead>
          <tbody>
            {UNIQUE_CREDITS.map((c) => (
              <tr key={c.id} className="border-ink/8 border-b align-top">
                <th scope="row" className="py-3 pr-4 font-normal">
                  <span className="break-words">{c.title.replace(/^File:/, '')}</span>
                </th>
                <td className="py-3 pr-4">{c.author}</td>
                <td className="py-3 pr-4 whitespace-nowrap">
                  <a
                    href={c.licenseUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-clay"
                  >
                    {c.license}
                  </a>
                </td>
                <td className="py-3">
                  <a
                    href={c.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="underline underline-offset-2 hover:text-clay"
                  >
                    {t('viewSource')}
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
