'use client';

import type { StudioClient } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { buttonVariants } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { DashboardSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
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
    return <DashboardSkeleton label={t('loading')} className={`${box} pt-8`} />;
  }
  if (state.kind === 'unauthenticated') return <p className={box}>{t('signIn')}</p>;
  if (state.kind === 'not-household') {
    return (
      <EmptyState
        className={box}
        illustration="vase"
        title={t('notHousehold')}
        action={
          <Link href="/dang-ky-nghe-nhan" className={buttonVariants()}>
            {t('registerHousehold')}
          </Link>
        }
      />
    );
  }
  if (state.kind === 'error' || !client) {
    return <ErrorState className={box} message={t('loadFailed')} onRetry={() => void reload()} />;
  }
  const content = children({ household: state.household, client, reload });
  if (!state.refreshError) return content;
  return (
    <>
      <p role="status" className={`${box} pb-0 text-small text-seal`}>
        {t('refreshFailed')}
      </p>
      {content}
    </>
  );
}
