'use client';

import type { ProductCardDto } from '@vcraft/contracts';
import { buttonVariants } from '@vcraft/ui';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { CardGridSkeleton } from '@/components/states/skeletons';
import { ProductCard } from '@/features/catalog/product-card';
import { toProductCardView } from '@/features/catalog/view-models';
import { Link } from '@/i18n/navigation';
import { favouritesStore } from './favourites-store';
import { useFavourites } from './use-favourites';

/**
 * The saved products (FR-CAT-07): the account's list when signed in, else the ones saved in this browser.
 * A product removed with its heart leaves the grid at once.
 */
export function FavouritesList() {
  const t = useTranslations('favourites');
  const locale = useLocale();
  const { ids, ready, mode } = useFavourites();
  const [cards, setCards] = useState<readonly ProductCardDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: `attempt` re-runs the fetch when the user retries.
  useEffect(() => {
    if (!ready) return;
    let active = true;
    favouritesStore
      .fetchCards()
      .then((next) => {
        if (!active) return;
        setCards(next);
        setFailed(false);
      })
      .catch(() => active && setFailed(true));
    return () => {
      active = false;
    };
  }, [ready, mode, attempt]);

  if (failed) {
    return (
      <ErrorState
        message={t('loadFailed')}
        onRetry={() => {
          setFailed(false);
          setAttempt((count) => count + 1);
        }}
      />
    );
  }
  if (!ready || cards === null)
    return <CardGridSkeleton label={t('loading')} className="" withHeader={false} />;

  const visible = cards.filter((card) => ids.has(card.id));
  if (visible.length === 0) {
    return (
      <EmptyState
        illustration="vase"
        title={t('empty')}
        description={t('emptyHint')}
        action={
          <Link href="/san-pham" className={buttonVariants({ variant: 'secondary' })}>
            {t('browse')}
          </Link>
        }
      />
    );
  }
  return (
    <>
      {mode === 'guest' ? <p className="mb-6 text-small text-ash">{t('guestNote')}</p> : null}
      <ul className="grid grid-cols-2 gap-6 md:grid-cols-4" aria-label={t('listLabel')}>
        {visible.map((card) => (
          <li key={card.id}>
            <ProductCard product={toProductCardView(card, locale)} />
          </li>
        ))}
      </ul>
    </>
  );
}
