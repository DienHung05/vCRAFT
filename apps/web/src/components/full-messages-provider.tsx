import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Gives the client components below it the whole dictionary. The root layout provides only the public
 * subset (`lib/public-messages.ts`); the signed-in areas (studio, admin, account, RFQ, sign-in) read
 * far more, so their layouts wrap everything in this.
 */
export async function FullMessagesProvider({ children }: { children: ReactNode }) {
  return <NextIntlClientProvider messages={await getMessages()}>{children}</NextIntlClientProvider>;
}
