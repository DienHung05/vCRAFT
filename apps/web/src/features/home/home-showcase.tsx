import { buttonVariants, TraceSealFrame } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { cache } from 'react';
import { fetchProducts } from '@/features/catalog/exhibition-api';
import { Link } from '@/i18n/navigation';

/**
 * The one product the hero proves with a trace seal. `cache` only dedupes the read within this render;
 * the fetch underneath stays `no-store`, so a withdrawn product leaves the hero on the next request.
 */
const showcaseProduct = cache(async () => {
  const result = await fetchProducts({ limit: 1 });
  return result.status === 'ok' ? result.data.data[0] : undefined;
});

/** Hero trace link, streamed separately so the headline and vase never wait for the catalog. */
export async function HeroTraceCta() {
  const [t, showcase] = await Promise.all([getTranslations('home'), showcaseProduct()]);
  if (!showcase) return null;
  return (
    <Link
      href={{ pathname: '/truy-xuat/[code]', params: { code: showcase.traceCode } }}
      className={buttonVariants({ variant: 'secondary', size: 'lg' })}
    >
      {t('hero.ctaTrace')}
    </Link>
  );
}

/** The trace seal over the vase; absolute, so it never moves the hero when it arrives. */
export async function HeroTraceSeal() {
  const [t, showcase] = await Promise.all([getTranslations('home'), showcaseProduct()]);
  if (!showcase) return null;
  return (
    <div className="absolute -bottom-6 -left-4 hidden rotate-[-4deg] rounded-card bg-paper p-3 shadow-warm sm:block">
      <TraceSealFrame code={showcase.traceCode} size={112} title={t('hero.sealAlt')}>
        <span className="font-display text-h3 text-seal type-wonk">vC</span>
      </TraceSealFrame>
    </div>
  );
}
