import { thumbHashToDataURL } from 'thumbhash';

/**
 * Blurred placeholder (PNG data URL) for a ThumbHash the API returned as base64, or `undefined` when there is
 * none or it cannot be decoded: callers then keep their plain tinted background.
 */
export function thumbhashDataUrl(hash: string | null | undefined): string | undefined {
  if (!hash) return undefined;
  try {
    return thumbHashToDataURL(Uint8Array.from(atob(hash), (char) => char.charCodeAt(0)));
  } catch {
    return undefined;
  }
}

/** Inline style that paints the ThumbHash behind an image until the optimized file has loaded. */
export function thumbhashStyle(
  hash: string | null | undefined,
): { background: string } | undefined {
  const url = thumbhashDataUrl(hash);
  return url ? { background: `center / cover no-repeat url(${url})` } : undefined;
}
