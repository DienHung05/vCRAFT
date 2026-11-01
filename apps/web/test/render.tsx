import { type RenderResult, render } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { formats } from '@/i18n/formats';

/** Dựng component client trong provider i18n thật (từ điển vi), giống layout `[locale]`. */
export function renderVi(ui: ReactElement): RenderResult {
  return renderLocale('vi', ui);
}

/** Same as `renderVi` with the English catalog. */
export function renderEn(ui: ReactElement): RenderResult {
  return renderLocale('en', ui);
}

function renderLocale(locale: 'vi' | 'en', ui: ReactElement): RenderResult {
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      formats={formats}
      timeZone="Asia/Ho_Chi_Minh"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
