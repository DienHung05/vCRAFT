import { notFound } from 'next/navigation';
import { hasLocale } from 'next-intl';
import { setRequestLocale } from 'next-intl/server';
import { routing } from '@/i18n/routing';

/** Đọc `[locale]` từ params, bật render tĩnh cho locale đó (next-intl `setRequestLocale`). */
export async function resolveLocale(params: Promise<{ locale: string }>) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  return locale;
}
