import { storageUrlFor } from '@/lib/deploy-config';

/**
 * Variant files are named by content hash, but any public Storage path can be asked for here, so keep
 * a day rather than "forever": a replaced file shows up within 24 hours.
 */
const ONE_DAY = 60 * 60 * 24;

/** Raster formats only: SVG can carry script, so it is never served from this origin. */
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);

/**
 * Serves a public Storage image from the page's own origin, backed by Next's data cache. Used for the
 * above-the-fold image only (`aboveTheFoldUrl`): it removes the handshake to the Storage origin and,
 * once cached, answers from this server instead of waiting on Storage, so the LCP paints sooner.
 * Only raster images are returned, and only from the project's own public Storage.
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<'/media-cache/[...path]'>,
): Promise<Response> {
  const { path } = await ctx.params;
  const target = storageUrlFor(path, process.env.NEXT_PUBLIC_SUPABASE_URL);
  if (!target) return new Response(null, { status: 404 });
  const upstream = await fetch(target, { next: { revalidate: ONE_DAY } }).catch(() => null);
  const type =
    (upstream?.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
  if (!upstream?.ok || !ALLOWED_TYPES.has(type)) return new Response(null, { status: 404 });
  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': `public, max-age=${ONE_DAY}, stale-while-revalidate=${ONE_DAY * 7}`,
    },
  });
}
