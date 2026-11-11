'use client';

import type { QuotationClient } from '@vcraft/api-client';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ListSkeleton } from '@/components/states/skeletons';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { OpenCoordinatedRequests } from './open-coordinated-requests';

/**
 * Page of the open coordinated requests a household can offer on without an invitation (BR-05a,
 * ADR-0026). It is the destination of the household's header tab; `/studio/bao-gia` stays the place
 * where invitations are answered (GH#490).
 */
export function StudioOpenRequests({ client: provided }: { client?: QuotationClient }) {
  const t = useTranslations('studio.invitations');
  const { client, loading } = useQuotationClient(provided);
  const [offered, setOffered] = useState(false);
  if (loading) {
    return (
      <ListSkeleton
        label={t('openLoading')}
        className="mx-auto max-w-editorial px-gutter py-8"
        rows={3}
      />
    );
  }
  if (!client) return <p className="mx-auto max-w-editorial px-gutter py-12">{t('signIn')}</p>;
  return (
    <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8">
      {offered ? (
        <p
          role="status"
          data-testid="open-requests-offered"
          className="flex flex-col gap-1 rounded-card border border-clay/30 bg-clay/12 p-4 text-small"
        >
          <span>{t('openOffered')}</span>
          <Link
            href="/studio/bao-gia"
            className="min-h-11 self-start py-2 text-clay underline underline-offset-4"
          >
            {t('openToInvitations')}
          </Link>
        </p>
      ) : null}
      <OpenCoordinatedRequests
        client={client}
        headingLevel={1}
        onOffered={() => setOffered(true)}
      />
    </div>
  );
}
