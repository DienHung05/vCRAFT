'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { OpenCoordinatedRequestDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { ErrorState } from '@/components/states/error-state';
import { ContributionForm, type ContributionFormValues } from '@/features/rfq/contribution-form';
import { DeadlineCountdown } from '@/features/rfq/deadline-countdown';
import { useIdempotentAction } from '@/lib/use-idempotent-action';

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
          {rows.map((row) => (
            <OpenRequestRow
              key={row.id}
              row={row}
              client={client}
              open={openId === row.id}
              onToggle={() => setOpenId(openId === row.id ? null : row.id)}
              onOffered={onOffered}
              onReload={load}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

/** One open request. Its own component keeps the retained offer key independent of the other rows. */
function OpenRequestRow({
  row,
  client,
  open,
  onToggle,
  onOffered,
  onReload,
}: {
  row: OpenCoordinatedRequestDto;
  client: QuotationClient;
  open: boolean;
  onToggle: () => void;
  onOffered?: (() => void) | undefined;
  onReload: () => Promise<void>;
}) {
  const t = useTranslations('studio.invitations');
  const contribution = useTranslations('contribution');
  const categories = useTranslations('catalog.categories');
  const format = useFormatter();
  const category = categories(row.category);
  // GH#444: one retained action per open request, so a retry of this offer keeps its key.
  const createOffer = useIdempotentAction();
  const send = async (values: ContributionFormValues) => {
    try {
      await createOffer([row.id, values], (options) =>
        client.createContribution(row.id, values, options),
      );
    } catch (error) {
      throw new Error(
        error instanceof QuotationApiError && error.code === 'RFQ_CAPACITY_EXCEEDED'
          ? contribution('capacityExceeded')
          : contribution('sendFailed'),
      );
    }
    onOffered?.();
    await onReload();
  };
  return (
    <li>
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
          aria-expanded={open}
          onClick={onToggle}
        >
          {open ? t('openHide') : t('openOffer')}
        </Button>
        {open ? (
          <ContributionForm
            rfqCode={category}
            quantity={row.quantity}
            unit={row.unit}
            biddingClosesAt={row.biddingClosesAt}
            requiredBy={row.requiredBy}
            onSubmit={send}
          />
        ) : null}
      </Card>
    </li>
  );
}
