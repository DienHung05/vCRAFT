import type { MetadataRoute } from 'next';

/**
 * Web app manifest (served at `/manifest.webmanifest`). Colours are the paper and glaze tokens of
 * packages/ui; the icons are drawn from the brand mark by scripts/brand/make-site-assets.mjs.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'vCraft',
    short_name: 'vCraft',
    description:
      'Tinh hoa làng nghề, muôn phương lan tỏa · The finest of the craft villages, shared far and wide',
    start_url: '/',
    display: 'standalone',
    background_color: '#f5efe4',
    theme_color: '#1e3a6e',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      {
        src: '/brand/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
