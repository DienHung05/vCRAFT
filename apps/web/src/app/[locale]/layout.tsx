import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Toaster } from '@/components/toaster';
import { UsdRateProvider } from '@/components/usd-rate-provider';
import { routing } from '@/i18n/routing';
import { FALLBACK_USD_RATE, showsUsdReference } from '@/lib/currency';
import { getUsdRate } from '@/lib/usd-rate';
import '../../styles/globals.css';

// Fraunces ships only the SOFT axis: the full opsz/SOFT/WONK file was ~120KB for latin alone, and the
// brand uses neither opsz nor WONK on any glyph in the wordmark or headings.
// Tự host qua next/font (BRAND §4), subset vietnamese + latin. Tên biến CSS khớp
// `--font-display/sans/mono` trong packages/ui/src/tokens/theme.css.
const fraunces = Fraunces({
  subsets: ['vietnamese', 'latin'],
  axes: ['SOFT'],
  variable: '--font-fraunces',
  display: 'swap',
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ['vietnamese', 'latin'],
  weight: ['400', '500', '600'],
  variable: '--font-be-vietnam',
  display: 'swap',
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ['vietnamese', 'latin'],
  variable: '--font-jetbrains-mono',
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
    title: { default: t('title'), template: `%s · vCraft` },
    description: t('description'),
  };
}

export default async function LocaleLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  // Only the English site shows USD (FR-CAT-08). The rate comes from Next's data cache (24h), so
  // this adds no request for visitors and the pages stay statically cacheable.
  const usdRate = showsUsdReference(locale) ? await getUsdRate() : FALLBACK_USD_RATE;

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${beVietnamPro.variable} ${jetBrainsMono.variable}`}
    >
      <body className="grain-fixed">
        <NextIntlClientProvider>
          <UsdRateProvider value={usdRate}>{children}</UsdRateProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
