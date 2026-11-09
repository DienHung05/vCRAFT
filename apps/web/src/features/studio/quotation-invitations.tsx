'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { MyInvitationDto } from '@vcraft/contracts';
import { Badge, buttonVariants, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { DeadlineCountdown } from '@/features/rfq/deadline-countdown';
import { RfqStepper } from '@/features/rfq/rfq-stepper';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';
import { useMoney } from '@/lib/use-money';
import { isOpenInvitation } from './invitation-summary';

const isOpen = (row: MyInvitationDto) => isOpenInvitation(row);

/** Invitation list of the household (FR-RFQ-04): deadline countdown, own offer, link to respond. */
export function QuotationInvitations({ client: provided }: { client?: QuotationClient }) {
  const t = useTranslations('studio.invitations');
  const { client, loading } = useQuotationClient(provided);
  if (loading) {
    return (
      <ListSkeleton
        label={t('loading')}
        className="mx-auto max-w-editorial px-gutter py-8"
        rows={3}
      />
    );
  }
  if (!client) return <p className="mx-auto max-w-editorial px-gutter py-12">{t('signIn')}</p>;
  return <Invitations client={client} />;
}

function Invitations({ client }: { client: QuotationClient }) {
  const t = useTranslations('studio.invitations');
  const format = useFormatter();
  const money = useMoney();
  const [rows, setRows] = useState<readonly MyInvitationDto[] | null>(null);
  const [state, setState] = useState<'ok' | 'failed' | 'signed-out'>('ok');

  const load = useCallback(async () => {
    setState('ok');
    try {
      setRows(await client.listInvitations());
    } catch (error) {
      setState(
        error instanceof QuotationApiError && error.status === 401 ? 'signed-out' : 'failed',
      );
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const offerLabel = ({ request, contribution, declined, directQuotation }: MyInvitationDto) => {
    // A request without coordination is quoted by the household itself (FR-RFQ-04).
    if (!request.coordinationOptIn && directQuotation) {
      if (directQuotation.status === 'SUBMITTED')
        return t('directActive', {
          price: money(directQuotation.unitPriceVnd),
          unit: request.unit,
          total: money(directQuotation.totalVnd),
        });
      if (directQuotation.status === 'ACCEPTED') return t('directAccepted');
      if (directQuotation.status === 'REJECTED') return t('directRejected');
    }
    if (contribution?.status === 'ACTIVE')
      return t('active', {
        price: money(contribution.unitPriceVnd),
        unit: request.unit,
        quantity: format.number(contribution.maxQuantity),
      });
    if (declined) return t('declined');
    return contribution ? t('withdrawn') : t('noOffer');
  };

  return (
    <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-ash">{t('lead')}</p>
      </header>
      {state === 'signed-out' ? (
        <p>{t('signIn')}</p>
      ) : state === 'failed' ? (
        <ErrorState message={t('failed')} onRetry={() => void load()} />
      ) : rows === null ? (
        <ListSkeleton label={t('loading')} className="" rows={3} withHeader={false} />
      ) : rows.length === 0 ? (
        <>
          <EmptyState
            illustration="scroll"
            title={t('empty')}
            description={t('emptyHint')}
            action={
              <Link href="/studio/ho-so" className={buttonVariants({ variant: 'secondary' })}>
                {t('emptyAction')}
              </Link>
            }
          />
          <InvitationRule />
        </>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="invitations">
          {rows.map((row) => (
            <li key={row.request.id}>
              <Card className="flex flex-col gap-2 p-4">
                <h2 className="text-h3 break-words">{row.request.title}</h2>
                <RfqStepper
                  status={row.request.status}
                  hasBids={row.request.hasBids ?? Boolean(row.directQuotation)}
                />
                <p className="text-small">
                  {t('quantity', {
                    quantity: format.number(row.request.quantity),
                    unit: row.request.unit,
                  })}
                </p>
                <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ash">
                  <span>
                    {t('deadline')}:{' '}
                    <time dateTime={row.request.biddingClosesAt}>
                      {format.dateTime(new Date(row.request.biddingClosesAt), 'short')}
                    </time>
                  </span>
                  {isOpen(row) ? <DeadlineCountdown until={row.request.biddingClosesAt} /> : null}
                </p>
                <p className="flex flex-wrap items-center gap-2 text-small">
                  {/* The offer summary is a sentence; it wraps on a phone instead of widening the page. */}
                  <Badge
                    tone={
                      row.contribution?.status === 'ACTIVE' ||
                      row.directQuotation?.status === 'SUBMITTED' ||
                      row.directQuotation?.status === 'ACCEPTED'
                        ? 'clay'
                        : 'outline'
                    }
                    className="whitespace-normal"
                  >
                    {offerLabel(row)}
                  </Badge>
                  {isOpen(row) ? null : <Badge tone="outline">{t('closed')}</Badge>}
                </p>
                <Link
                  href={{
                    pathname: '/studio/de-xuat-tham-gia/[id]',
                    params: { id: row.request.id },
                  }}
                  className="min-h-11 self-start py-2 text-small text-clay underline underline-offset-4"
                >
                  {t('open')}
                </Link>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** BR-05 in plain words, with the two things a household can do about it (GH#388). */
function InvitationRule() {
  const t = useTranslations('studio.invitations');
  return (
    <Card
      className="mx-auto flex w-full max-w-prose-vn flex-col gap-3 p-5"
      data-testid="invitation-rule"
    >
      <h2 className="text-h3">{t('emptyRuleTitle')}</h2>
      <p className="text-small text-ash">{t('emptyRuleLead')}</p>
      <ul className="list-disc pl-5 text-small">
        <li>{t('emptyRule1')}</li>
        <li>{t('emptyRule2')}</li>
        <li>{t('emptyRule3')}</li>
        <li>{t('emptyRule4')}</li>
      </ul>
      <p className="text-small text-ash">{t('emptyRuleNote')}</p>
      <div className="flex flex-wrap gap-3">
        <Link
          href={{ pathname: '/studio/ho-so', hash: 'capacity' }}
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {t('emptyCapacity')}
        </Link>
        <Link
          href="/studio/san-pham/moi"
          className={buttonVariants({ variant: 'secondary', size: 'sm' })}
        >
          {t('emptyAddProduct')}
        </Link>
      </div>
    </Card>
  );
}
