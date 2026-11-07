import { type Locale, locales } from '@vcraft/i18n';
import type { Metadata } from 'next';
import { localizedPath } from './sitemap-entries';

type Href = Parameters<typeof localizedPath>[0];

/**
 * Per-page metadata (GH#256): a canonical URL and hreflang alternates in the HTML head, and Open Graph and
 * Twitter titles that name the page instead of repeating the site defaults. Next.js replaces `openGraph` as
 * a whole, so the site-wide fields are restated here. The share image still comes from the route's
 * `opengraph-image` file. URLs are relative and resolve against the layout's `metadataBase`.
 */
export function pageMetadata({
  locale,
  href,
  title,
  description,
  type = 'website',
}: {
  locale: Locale;
  href: Href;
  title: string;
  description?: string | undefined;
  type?: 'website' | 'article';
}): Metadata {
  const url = localizedPath(href, locale);
  const languages = Object.fromEntries(locales.map((l) => [l, localizedPath(href, l)]));
  return {
    title,
    ...(description ? { description } : {}),
    alternates: { canonical: url, languages: { ...languages, 'x-default': languages.vi } },
    openGraph: {
      type,
      siteName: 'vCraft',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      url,
      title,
      ...(description ? { description } : {}),
    },
    twitter: { card: 'summary_large_image', title, ...(description ? { description } : {}) },
  };
}

/** Shortens text for a meta description without cutting a word in half. */
export function metaDescription(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  return `${cut.slice(0, cut.lastIndexOf(' ') > 80 ? cut.lastIndexOf(' ') : cut.length)}…`;
}

/** A schema.org JSON-LD block, safe to inline: `<` is escaped so text cannot close the script tag. */
export function jsonLd(data: Record<string, unknown>): string {
  return JSON.stringify({ '@context': 'https://schema.org', ...data }).replace(/</g, '\\u003c');
}
