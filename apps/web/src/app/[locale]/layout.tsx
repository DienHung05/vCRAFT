import type { Metadata } from 'next';
import { Be_Vietnam_Pro, Fraunces, JetBrains_Mono } from 'next/font/google';
import { notFound } from 'next/navigation';
import { hasLocale, NextIntlClientProvider } from 'next-intl';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Toaster } from '@/components/toaster';
import { routing } from '@/i18n/routing';
import '../../styles/globals.css';

// Tự host qua next/font (BRAND §4), subset vietnamese + latin. Tên biến CSS khớp
// `--font-display/sans/mono` trong packages/ui/src/tokens/theme.css.
const fraunces = Fraunces({
  subsets: ['vietnamese', 'latin'],
  axes: ['opsz', 'SOFT', 'WONK'],
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

  return (
    <html
      lang={locale}
      className={`${fraunces.variable} ${beVietnamPro.variable} ${jetBrainsMono.variable}`}
    >
      <body className="grain-fixed">
        <NextIntlClientProvider>
          {children}
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
