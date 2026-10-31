'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { MyInvitationDto } from '@vcraft/contracts';
import { Badge, Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { DeadlineCountdown } from '@/features/rfq/deadline-countdown';
import { Link } from '@/i18n/navigation';
import { useQuotationClient } from '@/lib/api/use-quotation-client';

const isOpen = ({ request }: MyInvitationDto) =>
  ['SENT', 'BIDDING'].includes(request.status) &&
  new Date(request.biddingClosesAt).getTime() > Date.now();

/** Invitation list of the household (FR-RFQ-04): deadline countdown, own offer, link to respond. */
export function QuotationInvitations({ client: provided }: { client?: QuotationClient }) {
  const t = useTranslations('studio.invitations');
  const { client, loading } = useQuotationClient(provided);
  if (loading) return <p className="mx-auto max-w-editorial px-gutter py-12">{t('loading')}</p>;
  if (!client) return <p className="mx-auto max-w-editorial px-gutter py-12">{t('signIn')}</p>;
  return <Invitations client={client} />;
}

function Invitations({ client }: { client: QuotationClient }) {
  const t = useTranslations('studio.invitations');
  const format = useFormatter();
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

  const offerLabel = ({ request, contribution, declined }: MyInvitationDto) => {
    if (contribution?.status === 'ACTIVE')
      return t('active', {
        price: format.number(contribution.unitPriceVnd, 'vnd'),
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
        <div role="alert" className="flex flex-col items-start gap-3">
          <p>{t('failed')}</p>
          <Button type="button" variant="secondary" onClick={() => void load()}>
            {t('retry')}
          </Button>
        </div>
      ) : rows === null ? (
        <p role="status">{t('loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-ash">{t('empty')}</p>
      ) : (
        <ul className="flex flex-col gap-3" data-testid="invitations">
          {rows.map((row) => (
            <li key={row.request.id}>
              <Card className="flex flex-col gap-2 p-4">
                <h2 className="text-h3 break-words">{row.request.title}</h2>
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
                  <Badge tone={row.contribution?.status === 'ACTIVE' ? 'clay' : 'outline'}>
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
