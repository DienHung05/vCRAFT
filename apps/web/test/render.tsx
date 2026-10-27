import { type RenderResult, render } from '@testing-library/react';
import { messages } from '@vcraft/i18n';
import { NextIntlClientProvider } from 'next-intl';
import type { ReactElement } from 'react';
import { formats } from '@/i18n/formats';

/** Dựng component client trong provider i18n thật (từ điển vi), giống layout `[locale]`. */
export function renderVi(ui: ReactElement): RenderResult {
  return render(
    <NextIntlClientProvider
      locale="vi"
      messages={messages.vi}
      formats={formats}
      timeZone="Asia/Ho_Chi_Minh"
    >
      {ui}
    </NextIntlClientProvider>,
  );
}
