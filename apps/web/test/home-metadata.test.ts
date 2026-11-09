import { describe, expect, it, vi } from 'vitest';

vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => `meta.${key}`,
}));
vi.mock('@/i18n/navigation', () => ({ Link: () => null }));
vi.mock('@/lib/locale', () => ({ resolveLocale: async () => 'en' }));
// The page module pulls in client-only experience code that is irrelevant to its metadata.
vi.mock('@/experience/hero-vase/hero-vase', () => ({ HeroVase: () => null }));
vi.mock('@/experience/hero-vase/turning-vase', () => ({ TurningVase: () => null }));

describe('home metadata (GH#341)', () => {
  it('has a canonical URL, hreflang alternates and an absolute title', async () => {
    const { generateMetadata } = await import('@/app/[locale]/(marketing)/page');
    const meta = await generateMetadata({ params: Promise.resolve({ locale: 'en' }) } as never);
    expect(meta.alternates).toEqual({
      canonical: '/en',
      languages: { vi: '/vi', en: '/en', 'x-default': '/vi' },
    });
    expect(meta.title).toEqual({ absolute: 'meta.title' });
    expect(meta.openGraph).toMatchObject({ url: '/en', title: 'meta.title' });
  });
});
