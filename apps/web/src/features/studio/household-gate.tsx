'use client';

import type { StudioClient } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useHousehold } from './use-household';

/** Khung trạng thái chung của màn Studio: chỉ dựng nội dung khi đã có hồ sơ của hộ. */
export function HouseholdGate({
  client: provided,
  children,
}: {
  client?: StudioClient | undefined;
  children: (view: {
    household: HouseholdDto;
    client: StudioClient;
    reload: () => Promise<void>;
  }) => ReactNode;
}) {
  const t = useTranslations('studio');
  const { client, state, reload } = useHousehold(provided);
  const box = 'mx-auto max-w-editorial px-gutter py-12';
  if (state.kind === 'loading') {
    return (
      <p role="status" className={box}>
        {t('loading')}
      </p>
    );
  }
  if (state.kind === 'unauthenticated') return <p className={box}>{t('signIn')}</p>;
  if (state.kind === 'not-household') return <p className={box}>{t('notHousehold')}</p>;
  if (state.kind === 'error' || !client) {
    return (
      <div role="alert" className={`${box} flex flex-col items-start gap-3`}>
        <p>{t('loadFailed')}</p>
        <Button type="button" variant="secondary" onClick={() => void reload()}>
          {t('retry')}
        </Button>
      </div>
    );
  }
  return children({ household: state.household, client, reload });
}
