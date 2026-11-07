import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from 'next/font/google';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { InlineScript } from '@/components/inline-script';
import { Toaster } from '@/components/toaster';
import { UsdRateProvider } from '@/components/usd-rate-provider';
import { WebFonts } from '@/components/web-fonts';
import { routing } from '@/i18n/routing';
import { NONCE_HEADER } from '@/lib/csp';
import { FALLBACK_USD_RATE, showsUsdReference } from '@/lib/currency';
import { siteOrigin } from '@/lib/site';
import { THEME_SCRIPT } from '@/lib/theme';
import { getUsdRate } from '@/lib/usd-rate';
import { VIEW_TRANSITION_GUARD_SCRIPT } from '@/lib/view-transition';
import { FONTS_FLAG_SCRIPT, webFontVars } from '@/lib/web-fonts';
import '../../styles/globals.css';

// Fraunces ships only the SOFT axis: the full opsz/SOFT/WONK file was ~120KB for latin alone, and the
// brand uses neither opsz nor WONK on any glyph in the wordmark or headings.
// Tự host qua next/font (BRAND §4), subset vietnamese + latin. Tên biến CSS khớp
// `--font-display/sans/mono` trong packages/ui/src/tokens/theme.css.
// No preload and no `.variable` class: `--font-fraunces/-be-vietnam/-jetbrains-mono` are set by
// globals.css and the web fonts are only switched on after hydration (see lib/web-fonts.ts).
const fraunces = Fraunces({
  subsets: ['vietnamese', 'latin'],
  axes: ['SOFT'],
  display: 'swap',
  preload: false,
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  preload: false,
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  display: 'swap',
  // Mono only marks trace/RFQ codes; keep its 40KB latin file out of the critical path.
  preload: false,
});

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) return {};
  const t = await getTranslations({ locale, namespace: 'meta' });
  return {
    // Absolute origin for the share image and the other metadata URLs (see lib/site.ts).
    metadataBase: new URL(siteOrigin()),
    title: { default: t('title'), template: `%s · vCraft` },
    description: t('description'),
    openGraph: {
      type: 'website',
      siteName: 'vCraft',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      title: t('title'),
      description: t('description'),
    },
    twitter: { card: 'summary_large_image', title: t('title'), description: t('description') },
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // The CSP nonce from proxy.ts (NFR-SEC-04). Reading request headers makes every page render per request,
  // which a per-request nonce needs anyway: a prerendered page could not carry one.
  const nonce = (await headers()).get(NONCE_HEADER) ?? undefined;
  // Only the English site shows USD (FR-CAT-08). The rate comes from Next's data cache (24h), so
  // this adds no request for visitors and the pages stay statically cacheable.
  const usdRate = showsUsdReference(locale) ? await getUsdRate() : FALLBACK_USD_RATE;

  return (
    <html
      lang={locale}
      style={webFontVars({
        'font-fraunces': fraunces.style.fontFamily,
        'font-be-vietnam': beVietnamPro.style.fontFamily,
        'font-jetbrains-mono': jetBrainsMono.style.fontFamily,
      })}
      // The head scripts below may set data-fonts and data-theme before React hydrates.
      suppressHydrationWarning
    >
      <head>
        <InlineScript code={FONTS_FLAG_SCRIPT} nonce={nonce} />
        <InlineScript code={THEME_SCRIPT} nonce={nonce} />
        <InlineScript code={VIEW_TRANSITION_GUARD_SCRIPT} nonce={nonce} />
        <noscript>
          {/* Without JS nothing flips data-fonts, so the web fonts are switched on by CSS alone. */}
          <style>
            {
              ':root{--font-fraunces:var(--font-fraunces-web);--font-be-vietnam:var(--font-be-vietnam-web);--font-jetbrains-mono:var(--font-jetbrains-mono-web)}'
            }
          </style>
        </noscript>
      </head>
      <body className="grain-fixed">
        <WebFonts />
        <NextIntlClientProvider>
          <UsdRateProvider value={usdRate}>{children}</UsdRateProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
