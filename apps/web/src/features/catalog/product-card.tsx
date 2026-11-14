import { Badge, ProductFigure } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { ViewTransition } from 'react';
import { ImageSlot } from '@/components/image-slot';
import { UsdReference } from '@/components/usd-reference';
import { FavouriteButton } from '@/features/favourites/favourite-button';
import { Link } from '@/i18n/navigation';
import { type ProductCardView, slotPhoto } from './view-models';

/** `sizes` of a card picture: the page also uses it for the cover preload, so both must match. */
export const PRODUCT_CARD_IMAGE_SIZES =
  '(min-width: 1440px) 312px, (min-width: 768px) calc(25vw - 3rem), calc(50vw - 1.5rem)';

/**
 * Thẻ sản phẩm: ảnh 4:5 (BRAND §5), tên, giá; nhãn "Độc bản" dạng ấn. `heading` là cấp tiêu đề của
 * tên: h3 khi thẻ nằm dưới một h2 của trang, h2 khi ngay dưới h1 (không nhảy cấp). Giá `0` là chưa
 * niêm yết. Dùng được ở cả server và client.
 */
export function ProductCard({
  product,
  heading: Heading = 'h3',
  priority = false,
}: {
  product: ProductCardView;
  heading?: 'h2' | 'h3';
  /** Above-the-fold card (LCP candidate): its picture loads eagerly with high fetch priority. */
  priority?: boolean;
}) {
  const t = useTranslations('common');
  const preset = useTranslations('presetFigure');
  const format = useFormatter();
  return (
    // The heart is a sibling of the link, not inside it: a button must not sit within an anchor.
    <div className="relative">
      <Link
        href={{ pathname: '/san-pham/[slug]', params: { slug: product.slug } }}
        className="group block"
      >
        {/* Shares its name with the detail hero, so the picture morphs into it on navigation (PLAN E7). */}
        <ViewTransition
          name={productImageTransition(product.slug)}
          share="product-morph"
          default="none"
        >
          <ImageSlot
            alt={product.image?.alt ?? preset(product.presetKind)}
            tint={product.tint}
            ratio="4/5"
            {...slotPhoto(product.image)}
            sizes={PRODUCT_CARD_IMAGE_SIZES}
            priority={priority}
            className="grid place-items-center motion-safe:transition-transform motion-safe:duration-(--duration-slow) motion-safe:ease-clay motion-safe:group-hover:-translate-y-1"
          >
            {product.image ? null : (
              <ProductFigure
                kind={product.presetKind}
                className="h-1/2 opacity-90"
                body="var(--color-paper)"
                band={product.tint}
              />
            )}
            {product.oneOfAKind ? (
              <Badge tone="seal" className="absolute top-3 left-3 bg-paper">
                {t('oneOfAKind')}
              </Badge>
            ) : null}
            {product.sold ? (
              <Badge tone="outline" className="absolute top-3 right-14 bg-paper">
                {t('sold')}
              </Badge>
            ) : null}
          </ImageSlot>
        </ViewTransition>
        <div className="mt-3 flex min-w-0 flex-col gap-1 lg:flex-row lg:items-baseline lg:justify-between lg:gap-3">
          <Heading className="min-w-0 break-words font-sans text-body font-medium text-ink transition-colors group-hover:text-clay">
            {product.name}
          </Heading>
          <span className="shrink-0 text-small text-ash lg:text-right">
            {product.price > 0 ? format.number(product.price, 'vnd') : t('priceOnRequest')}
            <UsdReference vnd={product.price} className="block text-[0.75rem]" />
          </span>
        </div>
      </Link>
      <FavouriteButton
        productId={product.id}
        name={product.name}
        className="absolute top-3 right-3"
      />
    </div>
  );
}

/** View transition name shared by a product's card picture and its detail hero. */
export function productImageTransition(slug: string): string {
  return `product-image-${slug}`;
}

/** Khung chờ giữ đúng bố cục lưới thẻ, để lúc dữ liệu về trang không nhảy. */
export function ProductGridSkeleton({ label, count = 8 }: { label: string; count?: number }) {
  return (
    <div
      role="status"
      aria-label={label}
      data-testid="product-skeleton"
      className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-4 md:gap-x-8"
    >
      {Array.from({ length: count }, (_, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: khung chờ giống hệt nhau, không đổi thứ tự.
        <div key={index} className="animate-pulse motion-reduce:animate-none">
          <div className="aspect-[4/5] rounded-card bg-ink/8" />
          <div className="mt-3 h-4 w-3/4 rounded-input bg-ink/8" />
        </div>
      ))}
    </div>
  );
}
