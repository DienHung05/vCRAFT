'use client';

import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';

function CheckingPlaceholder() {
  const t = useTranslations('auth');
  // Same box the real menu renders while it checks the session, so the header does not jump.
  return <span role="status" aria-label={t('nav.checking')} className="block h-9 w-20" />;
}

/**
 * Account menu for the public header, loaded after hydration (`ssr: false`). It pulls in the Supabase
 * SDK and the API client, which no public page needs for its first paint.
 */
export const LazyAccountMenu = dynamic(() => import('./account-menu').then((m) => m.AccountMenu), {
  ssr: false,
  loading: () => <CheckingPlaceholder />,
});
