import { getTranslations } from 'next-intl/server';
import type { ReactNode } from 'react';
import { LazyAssistantWidget } from '@/features/assistant/assistant-widget-lazy';
import { SiteFooter } from './site-footer';
import { SiteHeader } from './site-header';

/** Khung trang công khai: link bỏ qua, header, nội dung, footer, and the Fox assistant (FR-AST-01). */
export async function PublicShell({ children }: { children: ReactNode }) {
  const t = await getTranslations('common');
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-input focus:bg-ink focus:px-4 focus:py-2 focus:text-paper"
      >
        {t('skip')}
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1}>
        {children}
      </main>
      <SiteFooter />
      <LazyAssistantWidget />
    </>
  );
}
