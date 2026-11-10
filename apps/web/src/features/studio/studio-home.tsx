'use client';

import type { QuotationClient, StudioClient } from '@vcraft/api-client';
import type { HouseholdDto } from '@vcraft/contracts';
import { Badge, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { HouseholdGate } from './household-gate';
import { summarizeInvitations } from './invitation-summary';

/** Trang chủ Studio: trạng thái hồ sơ, độ hoàn thiện kèm gợi ý, số liệu và làm nhanh (FR-ART-07). */
export function StudioHome({
  client,
  quotationClient,
}: {
  client?: StudioClient;
  quotationClient?: QuotationClient;
}) {
  return (
    <HouseholdGate client={client}>
      {({ household }) => <HomeView household={household} quotationClient={quotationClient} />}
    </HouseholdGate>
  );
}

function HomeView({
  household,
  quotationClient,
}: {
  household: HouseholdDto;
  quotationClient?: QuotationClient | undefined;
}) {
  const t = useTranslations('studio.home');
  const drafts = household.products.filter((p) => p.status === 'DRAFT').length;
  const published = household.products.filter((p) => p.status === 'PUBLISHED').length;
  const counts = [
    ['drafts', drafts],
    ['published', published],
    ['artisans', household.artisans.length],
    ['workshops', household.workshops.length],
  ] as const;
  const { percent, missing } = household.completeness;

  return (
    <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
      <header>
        <h1 className="text-h1">{t('title', { household: household.name })}</h1>
      </header>

      <Card className="flex flex-col gap-2 p-6">
        <h2 className="text-h3">{t('status')}</h2>
        <p>
          <Badge tone={household.status === 'APPROVED' ? 'lacquer' : 'outline'}>
            {t(`statuses.${household.status}`)}
          </Badge>
        </p>
        {household.statusReason ? (
          <p className="text-small text-ash">{t('reason', { reason: household.statusReason })}</p>
        ) : null}
      </Card>

      <Card className="flex flex-col gap-3 p-6">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-h3">{t('completeness')}</h2>
          <span className="font-display text-h2 text-glaze">{percent}%</span>
        </div>
        <progress className="h-2 w-full" max={100} value={percent} aria-label={t('completeness')} />
        {missing.length === 0 ? (
          <p className="text-small text-ash">{t('complete')}</p>
        ) : (
          <>
            <p className="text-small text-ash">{t('missingLead')}</p>
            <ul className="list-disc pl-5 text-small">
              {missing.map((section) => (
                <li key={section}>{t(`sections.${section}`)}</li>
              ))}
            </ul>
          </>
        )}
      </Card>

      <InvitationsCard client={quotationClient} />

      <section aria-labelledby="counts-title">
        <h2 id="counts-title" className="sr-only">
          {t('counts')}
        </h2>
        <dl className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {counts.map(([key, value]) => (
            <Card key={key} className="p-4">
              <dt className="text-small text-ash">{t(key)}</dt>
              <dd className="mt-1 font-display text-h2">{value}</dd>
            </Card>
          ))}
        </dl>
      </section>

      <section aria-labelledby="actions-title">
        <h2 id="actions-title" className="text-h3">
          {t('actions')}
        </h2>
        <div className="mt-3 flex flex-wrap gap-3">
          {household.status === 'APPROVED' ? (
            <Link href="/studio/san-pham/moi" className={buttonVariants({})}>
              {t('newProduct')}
            </Link>
          ) : null}
          <Link href="/studio/ho-so" className={buttonVariants({ variant: 'secondary' })}>
            {t('editProfile')}
          </Link>
          {household.status === 'APPROVED' ? (
            <Link
              href={{ pathname: '/nghe-nhan/[slug]', params: { slug: household.slug } }}
              className={buttonVariants({ variant: 'secondary' })}
            >
              {t('viewPublic')}
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}

/**
 * Open invitations and the nearest bidding deadline (GH#388), so a household sees quotation work
 * from its home page. Quiet while loading or when the list cannot be read: it is a shortcut, not a
 * required part of the page.
 */
function InvitationsCard({ client: provided }: { client?: QuotationClient | undefined }) {
  const t = useTranslations('studio.home');
  const format = useFormatter();
  const { client } = useQuotationClient(provided);
  const [summary, setSummary] = useState<ReturnType<typeof summarizeInvitations> | null>(null);

  useEffect(() => {
    if (!client) return;
    let active = true;
    client
      .listInvitations()
      .then((rows) => active && setSummary(summarizeInvitations(rows)))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [client]);

  if (!summary) return null;
  return (
    <Card className="flex flex-col gap-2 p-6" data-testid="invitations-card">
      <h2 className="text-h3">{t('invitations')}</h2>
      {summary.openCount > 0 ? (
        <>
          <p className="font-display text-h2 text-glaze">
            {t('invitationsOpen', { count: summary.openCount })}
          </p>
          {summary.nearestDeadline ? (
            <p className="text-small text-ash">
              {t('invitationsNearest', {
                deadline: format.dateTime(new Date(summary.nearestDeadline), 'short'),
              })}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-small text-ash">{t('invitationsNone')}</p>
      )}
      <Link
        href="/studio/bao-gia"
        className="min-h-11 self-start py-2 text-small text-clay underline underline-offset-4"
      >
        {t('invitationsLink')}
      </Link>
    </Card>
  );
}
