import { SealMark, WaveDivider } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/i18n/navigation';

export async function SiteFooter() {
  const t = await getTranslations('footer');
  const nav = await getTranslations('nav');
  return (
    <footer className="mt-section">
      <WaveDivider />
      <div className="mx-auto grid max-w-editorial gap-10 px-gutter py-14 md:grid-cols-[1.4fr_1fr_1fr]">
        <div className="flex flex-col gap-4">
          <SealMark size={44} />
          <p className="max-w-xs font-display text-h3 text-glaze type-soft">{t('tagline')}</p>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-small font-semibold tracking-wide text-ash uppercase">
            {t('explore')}
          </h2>
          <ul className="space-y-2 text-small">
            <li>
              <Link href="/san-pham" className="hover:text-clay">
                {nav('products')}
              </Link>
            </li>
            <li>
              <Link href="/nghe-nhan" className="hover:text-clay">
                {nav('artisans')}
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 font-sans text-small font-semibold tracking-wide text-ash uppercase">
            {t('business')}
          </h2>
          <ul className="space-y-2 text-small">
            <li>
              <Link href="/yeu-cau-bao-gia" className="hover:text-clay">
                {nav('quotes')}
              </Link>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-ink/8 border-t">
        <div className="mx-auto flex max-w-editorial flex-wrap justify-between gap-2 px-gutter py-5 text-small text-ash">
          <span>{t('rights', { year: 2026 })}</span>
          <span>{t('demo')}</span>
        </div>
      </div>
    </footer>
  );
}
