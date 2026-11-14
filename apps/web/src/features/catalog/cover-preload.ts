import { preload } from 'react-dom';
import { describeImageRequest } from '@/lib/images';
import { PRODUCT_CARD_IMAGE_SIZES } from './product-card';
import type { ProductCardView } from './view-models';

/** How many leading cards get a `<link rel="preload">`: the ones a phone shows in the first row. */
export const PRELOADED_COVER_COUNT = 2;

/**
 * Asks the browser, from the document `<head>`, to start fetching the cover pictures of the first
 * cards. Mirrors what `ImageSlot` renders for a priority card (same origin mapping, same `srcset`
 * and `sizes`) so the preload is the file the `<img>` then uses. Cards without API variants
 * (demo photos, drawn stand-ins) are skipped.
 */
export function preloadCardCovers(products: readonly ProductCardView[]): void {
  for (const product of products.slice(0, PRELOADED_COVER_COUNT)) {
    const image = product.image;
    if (!image?.src) continue;
    const { preload: hint } = describeImageRequest({
      src: image.src,
      variants: image.variants,
      eager: true,
    });
    if (!hint) continue;
    preload(hint.src, {
      as: 'image',
      fetchPriority: 'high',
      imageSrcSet: hint.srcSet,
      imageSizes: PRODUCT_CARD_IMAGE_SIZES,
      type: hint.type,
    });
  }
}
