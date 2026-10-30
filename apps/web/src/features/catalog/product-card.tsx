import { Badge, VaseFigure } from '@vcraft/ui';
import { getFormatter, getTranslations } from 'next-intl/server';
import { ImageSlot } from '@/components/image-slot';
import { Link } from '@/i18n/navigation';
import type { Product } from '@/lib/demo/data';

/**
 * Thẻ sản phẩm: ảnh 4:5 (BRAND §5), tên, giá; nhãn "Độc bản" dạng ấn. `heading` là cấp tiêu đề của
 * tên: h3 khi thẻ nằm dưới một h2 của trang, h2 khi ngay dưới h1 (không nhảy cấp).
 */
export async function ProductCard({
  product,
  heading: Heading = 'h3',
}: {
  product: Product;
  heading?: 'h2' | 'h3';
}) {
  const [t, format] = await Promise.all([getTranslations('common'), getFormatter()]);
  return (
    <Link
      href={{ pathname: '/san-pham/[slug]', params: { slug: product.slug } }}
      className="group block"
    >
      <ImageSlot
        alt={product.name}
        tint={product.tint}
        ratio="4/5"
        className="grid place-items-center transition-transform duration-(--duration-slow) ease-clay group-hover:-translate-y-1"
      >
        <VaseFigure className="h-1/2 opacity-90" body="var(--color-paper)" band={product.tint} />
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
        <span className="shrink-0 text-small text-ash">{format.number(product.price, 'vnd')}</span>
      </div>
    </Link>
  );
}
