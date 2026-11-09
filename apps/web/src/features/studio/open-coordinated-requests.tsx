'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { OpenCoordinatedRequestDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/states/error-state';
import { ContributionForm, type ContributionFormValues } from '@/features/rfq/contribution-form';
import { DeadlineCountdown } from '@/features/rfq/deadline-countdown';

/**
 * BR-05a (ADR-0024): coordinated requests an administrator claimed, open to the household without an
 * invitation. Only a redacted summary is shown; sending an offer makes the household invited.
 */
export function OpenCoordinatedRequests({
  client,
  onOffered,
}: {
  client: QuotationClient;
  /** Called after an offer was sent, so the invitations list can show the new invitation. */
  onOffered?: () => void;
}) {
  const t = useTranslations('studio.invitations');
  const contribution = useTranslations('contribution');
  const categories = useTranslations('catalog.categories');
  const format = useFormatter();
  const [rows, setRows] = useState<readonly OpenCoordinatedRequestDto[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setRows(await client.listOpenCoordinatedRequests());
    } catch {
      setFailed(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  const send = (id: string) => async (values: ContributionFormValues) => {
    try {
      await client.createContribution(id, values);
    } catch (error) {
      throw new Error(
        error instanceof QuotationApiError && error.code === 'RFQ_CAPACITY_EXCEEDED'
          ? contribution('capacityExceeded')
          : contribution('sendFailed'),
      );
    }
    onOffered?.();
    await load();
  };

  return (
    <section className="flex flex-col gap-4" data-testid="open-requests">
      <header className="flex flex-col gap-2">
        <h2 className="text-h3">{t('openTitle')}</h2>
        <p className="text-small text-ash">{t('openLead')}</p>
      </header>
      {failed ? (
        <ErrorState message={t('openFailed')} onRetry={() => void load()} />
      ) : rows === null ? (
        <p className="text-small text-ash" role="status">
          {t('openLoading')}
        </p>
      ) : rows.length === 0 ? (
        <Card className="flex flex-col gap-2 p-4" data-testid="open-requests-empty">
          <p className="font-semibold">{t('openEmpty')}</p>
          <p className="text-small text-ash">{t('openEmptyHint')}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((row) => {
            const category = categories(row.category);
            return (
              <li key={row.id}>
                <Card className="flex flex-col gap-2 p-4">
                  <h3 className="text-h3 break-words">
                    {t('openRequest', {
                      category,
                      quantity: format.number(row.quantity),
                      unit: row.unit,
                    })}
                  </h3>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-ash">
                    <span>
                      {t('deadline')}:{' '}
                      <time dateTime={row.biddingClosesAt}>
                        {format.dateTime(new Date(row.biddingClosesAt), 'short')}
                      </time>
                    </span>
                    <DeadlineCountdown until={row.biddingClosesAt} />
                  </p>
                  <p className="text-small text-ash">
                    {t('requiredBy')}:{' '}
                    <time dateTime={row.requiredBy}>
                      {format.dateTime(new Date(row.requiredBy), 'short')}
                    </time>
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    className="min-h-11 self-start"
                    aria-expanded={openId === row.id}
                    onClick={() => setOpenId(openId === row.id ? null : row.id)}
                  >
                    {openId === row.id ? t('openHide') : t('openOffer')}
                  </Button>
                  {openId === row.id ? (
                    <ContributionForm
                      rfqCode={category}
                      quantity={row.quantity}
                      unit={row.unit}
                      biddingClosesAt={row.biddingClosesAt}
                      requiredBy={row.requiredBy}
                      onSubmit={send(row.id)}
                    />
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
