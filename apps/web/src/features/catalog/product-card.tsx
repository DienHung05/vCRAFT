import { Badge, VaseFigure } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { ImageSlot } from '@/components/image-slot';
import { UsdReference } from '@/components/usd-reference';
import { Link } from '@/i18n/navigation';
import { type ProductCardView, slotPhoto } from './view-models';

/**
 * Thẻ sản phẩm: ảnh 4:5 (BRAND §5), tên, giá; nhãn "Độc bản" dạng ấn. `heading` là cấp tiêu đề của
 * tên: h3 khi thẻ nằm dưới một h2 của trang, h2 khi ngay dưới h1 (không nhảy cấp). Giá `0` là chưa
 * niêm yết. Dùng được ở cả server và client.
 */
export function ProductCard({
  product,
  heading: Heading = 'h3',
}: {
  product: ProductCardView;
  heading?: 'h2' | 'h3';
}) {
  const t = useTranslations('common');
  const format = useFormatter();
  return (
    <Link
      href={{ pathname: '/san-pham/[slug]', params: { slug: product.slug } }}
      className="group block"
    >
      <ImageSlot
        alt={product.image?.alt ?? product.name}
        tint={product.tint}
        ratio="4/5"
        {...slotPhoto(product.image)}
        sizes="(min-width: 768px) 25vw, 50vw"
        className="grid place-items-center transition-transform duration-(--duration-slow) ease-clay group-hover:-translate-y-1"
      >
        {product.image ? null : (
          <VaseFigure className="h-1/2 opacity-90" body="var(--color-paper)" band={product.tint} />
        )}
        {product.oneOfAKind ? (
          <Badge tone="seal" className="absolute top-3 left-3 bg-paper">
            {t('oneOfAKind')}
          </Badge>
        ) : null}
      </ImageSlot>
      <div className="mt-3 flex items-baseline justify-between gap-3">
        <Heading className="font-sans text-body font-medium text-ink transition-colors group-hover:text-clay">
          {product.name}
        </Heading>
        <span className="shrink-0 text-right text-small text-ash">
          {product.price > 0 ? format.number(product.price, 'vnd') : t('priceOnRequest')}
          <UsdReference vnd={product.price} className="block text-[0.75rem]" />
        </span>
      </div>
    </Link>
  );
}

/** Khung chờ giữ đúng bố cục lưới thẻ, để lúc dữ liệu về trang không nhảy. */
export function ProductGridSkeleton({ label, count = 8 }: { label: string; count?: number }) {
  return (
    <div
      role="status"
      aria-label={label}
      data-testid="product-skeleton"
      className="grid grid-cols-2 gap-6 md:grid-cols-4"
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
