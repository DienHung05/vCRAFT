'use client';

import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { notify } from '@/lib/notify';
import { useFavourites } from './use-favourites';

function Heart({ filled }: { filled: boolean }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="size-5 shrink-0"
      fill={filled ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 20.5s-7.5-4.6-9.3-9.3C1.5 8 3.4 4.8 6.6 4.8c2 0 3.6 1.1 5.4 3.1 1.8-2 3.4-3.1 5.4-3.1 3.2 0 5.1 3.2 3.9 6.4-1.8 4.7-9.3 9.3-9.3 9.3Z" />
    </svg>
  );
}

/**
 * Heart toggle for a product (FR-CAT-07). A real button with `aria-pressed`: the label stays the same and
 * the pressed state tells whether the product is saved. `icon` sits on a product card; `labelled` shows
 * the word next to the heart (product page).
 */
export function FavouriteButton({
  productId,
  name,
  variant = 'icon',
  className,
}: {
  productId: string;
  name: string;
  variant?: 'icon' | 'labelled';
  className?: string;
}) {
  const t = useTranslations('favourites');
  const { ids, toggle } = useFavourites();
  const pressed = ids.has(productId);
  const onClick = async () => {
    if (!(await toggle(productId))) notify.error(t('failed'));
  };
  return (
    <button
      type="button"
      aria-pressed={pressed}
      {...(variant === 'icon' ? { 'aria-label': t('toggle', { name }) } : {})}
      onClick={onClick}
      className={cn(
        'inline-flex items-center justify-center gap-2 text-ink transition-colors focus-visible:outline-2 focus-visible:outline-glaze',
        variant === 'icon'
          ? 'size-9 rounded-full bg-paper/90 shadow-warm hover:bg-paper'
          : 'h-12 rounded-input px-4 text-small ring-1 ring-ink/15 hover:bg-ink/6',
        pressed && 'text-clay',
        className,
      )}
    >
      <Heart filled={pressed} />
      {variant === 'labelled' ? <span>{t('label')}</span> : null}
    </button>
  );
}
