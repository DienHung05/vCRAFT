import { sameOriginMediaUrl } from './deploy-config';

/** One generated size of a public image, as the API returns it (`variants` in the public contracts). */
export interface ImageVariant {
  format: 'avif' | 'webp';
  width: number;
  height: number;
  url: string;
}

export interface ResponsiveImage {
  /** `srcset` of the AVIF sizes, narrowest first; undefined when there is no AVIF. */
  avif?: string;
  /** `srcset` of the WebP sizes, narrowest first; undefined when there is no WebP. */
  webp?: string;
  /** Pixel size of the widest WebP (else AVIF) variant: the image's intrinsic ratio, for `width`/`height`. */
  width?: number;
  height?: number;
}

function srcSetOf(
  variants: readonly ImageVariant[],
  format: ImageVariant['format'],
  mapUrl: (url: string) => string,
) {
  // One entry per width: duplicates (same width listed twice) would make the srcset invalid.
  const byWidth = new Map<number, ImageVariant>();
  for (const variant of variants) {
    if (variant.format === format && variant.width > 0 && !byWidth.has(variant.width)) {
      byWidth.set(variant.width, variant);
    }
  }
  if (byWidth.size === 0) return undefined;
  return [...byWidth.values()]
    .sort((a, b) => a.width - b.width)
    .map((variant) => `${mapUrl(variant.url)} ${variant.width}w`)
    .join(', ');
}

/**
 * Turns the API's variants into `srcset` strings for a `<picture>` (AVIF first, WebP as the fallback).
 * Returns an empty object when there are no variants (static demo photos have one size), so callers can
 * fall back to the single `url`.
 */
export function buildResponsiveImage(
  variants: readonly ImageVariant[] | undefined,
  mapUrl: (url: string) => string = (url) => url,
): ResponsiveImage {
  if (!variants || variants.length === 0) return {};
  const avif = srcSetOf(variants, 'avif', mapUrl);
  const webp = srcSetOf(variants, 'webp', mapUrl);
  const widest = (format: ImageVariant['format']) =>
    variants.filter((v) => v.format === format).sort((a, b) => b.width - a.width)[0];
  const intrinsic = widest('webp') ?? widest('avif');
  return {
    ...(avif && { avif }),
    ...(webp && { webp }),
    ...(intrinsic && { width: intrinsic.width, height: intrinsic.height }),
  };
}

/**
 * Maps a public Storage URL onto the web's own origin (see `mediaRewrites`). For the above-the-fold
 * image only: it saves the handshake to the Storage origin on the LCP path.
 */
export function aboveTheFoldUrl(url: string): string {
  return sameOriginMediaUrl(url, process.env.NEXT_PUBLIC_SUPABASE_URL);
}
