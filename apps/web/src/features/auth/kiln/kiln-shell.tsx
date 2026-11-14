import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { KilnCard } from './kiln-card';
import { KilnSeal } from './kiln-seal';

/**
 * The page-level part of the kiln scene (the backdrop itself is `KilnStage`, rendered once by the layout):
 * the glowing trace seal, the tagline and the glazed card. From `lg` it is an asymmetric 12-column layout (seal and
 * tagline on the left, the 440px card on columns 8 to 12); below `lg` the 72px seal sits above a
 * full-width card and the tagline is hidden. `wide` (the household wizard) puts a 72px seal above a
 * `max-w-3xl` card at every width. The card is opaque, so every text run on it keeps AA contrast.
 */
export function KilnShell({
  header,
  children,
  wide = false,
  ornaments = true,
}: {
  /** Card heading block (h1 and lead). */
  header?: ReactNode;
  children: ReactNode;
  wide?: boolean;
  /** Brush ornaments draw on; the loading shell leaves them out so the page's draw-on is not replayed. */
  ornaments?: boolean;
}) {
  const t = useTranslations();
  // The tagline is shown as a display line, so its trailing full stop is dropped (the message is unchanged).
  const tagline = t('footer.tagline').replace(/\.$/, '');
  return (
    <div
      className={cn(
        // Compact vertical rhythm so the tile's inputs and primary action fit the first view on phones and laptops.
        // The extra bottom room below `lg` (pb-16) keeps the card's wave band inside the scene, clear of the footer's wave.
        'relative z-[2] mx-auto flex min-h-[inherit] w-full max-w-editorial flex-col items-center gap-2 px-gutter pt-1 pb-16 md:pt-4 lg:gap-0 lg:pt-3 lg:pb-4',
        !wide && 'lg:grid lg:grid-cols-12 lg:items-center lg:gap-x-8',
      )}
    >
      <div
        className={cn(
          'flex flex-col items-center',
          !wide && 'lg:col-span-6 lg:items-start lg:pb-6 xl:pl-10',
        )}
      >
        <KilnSeal large={!wide} />
        {wide ? null : (
          <>
            <p className="mt-9 hidden max-w-[27rem] font-display text-h2 font-semibold text-balance text-ink type-soft lg:block">
              {tagline}
            </p>
            <p className="kiln-sub mt-3.5 hidden max-w-sm text-body lg:block">
              {t('home.hero.title')}
            </p>
          </>
        )}
      </div>
      <KilnCard header={header} wide={wide} ornaments={ornaments}>
        {children}
      </KilnCard>
    </div>
  );
}
