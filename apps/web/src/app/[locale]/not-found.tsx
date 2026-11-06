import { buttonVariants, VaseFigure } from '@vcraft/ui';
import { getTranslations } from 'next-intl/server';
import { PublicShell } from '@/components/shell/public-shell';
import { Link } from '@/i18n/navigation';

export async function generateMetadata() {
  const t = await getTranslations('notFound');
  return {
    title: t('title'),
  };
}

export default async function NotFound() {
  const t = await getTranslations('notFound');
  return (
    <PublicShell>
      <section className="mx-auto flex max-w-prose-vn flex-col items-center gap-6 px-gutter py-section text-center">
        <VaseFigure className="h-28 opacity-80" body="var(--color-ash)" />
        <h1>{t('title')}</h1>
        <p className="text-ash">{t('text')}</p>
        <Link href="/" className={buttonVariants()}>
          {t('back')}
        </Link>
      </section>
    </PublicShell>
  );
}
