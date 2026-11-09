'use client';

import { Button, buttonVariants } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { Link } from '@/i18n/navigation';

/**
 * Generic screen for an uncaught error in a route segment. Mounted from `error.tsx` files placed inside
 * the route groups, so the group's shell (header and footer) stays visible around it. It says nothing
 * technical and offers a retry (`reset`) plus a way home; session problems have their own screen.
 */
export function RouteError({ reset }: { reset: () => void }) {
  const t = useTranslations('errors.generic');
  return (
    <section
      role="alert"
      className="mx-auto flex max-w-prose-vn flex-col items-center gap-5 px-gutter py-section text-center"
    >
      <h1>{t('title')}</h1>
      <p className="text-ash">{t('body')}</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Button type="button" onClick={reset}>
          {t('retry')}
        </Button>
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          {t('home')}
        </Link>
      </div>
    </section>
  );
}
