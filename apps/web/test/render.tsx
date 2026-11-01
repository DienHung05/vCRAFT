import { type RenderResult, render } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { UsdRateProvider } from '@/components/usd-rate-provider';
import { formats } from '@/i18n/formats';
import type { UsdRate } from '@/lib/currency';

/** Dựng component client trong provider i18n thật (từ điển vi), giống layout `[locale]`. */
export function renderVi(ui: ReactElement, usdRate?: UsdRate): RenderResult {
  return renderLocale('vi', ui, usdRate);
}

/** Same as `renderVi` with the English catalog. `usdRate` stands in for the daily rate from the layout. */
export function renderEn(ui: ReactElement, usdRate?: UsdRate): RenderResult {
  return renderLocale('en', ui, usdRate);
}

function renderLocale(locale: 'vi' | 'en', ui: ReactElement, usdRate?: UsdRate): RenderResult {
  const content = usdRate ? <UsdRateProvider value={usdRate}>{ui}</UsdRateProvider> : ui;
  return render(
    <NextIntlClientProvider
      locale={locale}
      messages={messages[locale]}
      formats={formats}
      timeZone="Asia/Ho_Chi_Minh"
    >
      {content}
    </NextIntlClientProvider>,
  );
}
