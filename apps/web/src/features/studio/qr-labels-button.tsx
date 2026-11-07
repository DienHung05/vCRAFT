'use client';

import type { StudioClient } from '@vcraft/api-client';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

// The worker usually finishes in a second or two; give up politely after ~1 minute.
const POLL_EVERY_MS = 1_500;
const POLL_ATTEMPTS = 40;

type State = 'idle' | 'busy' | 'failed' | 'timeout';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Asks the worker for an A4 sheet of QR labels (PLAN E6) and opens the PDF when it is ready. The sheet
 * holds `copies` labels for each product, in the order given.
 */
export function QrLabelsButton({
  client,
  productIds,
  label,
  copies = 1,
}: {
  client: Pick<StudioClient, 'requestQrLabels' | 'qrLabelsStatus'>;
  productIds: readonly string[];
  label: string;
  copies?: number;
}) {
  const t = useTranslations('studio.products.labels');
  const [state, setState] = useState<State>('idle');

  const run = async () => {
    setState('busy');
    try {
      const { requestId } = await client.requestQrLabels({ productIds: [...productIds], copies });
      for (let attempt = 0; attempt < POLL_ATTEMPTS; attempt++) {
        await wait(POLL_EVERY_MS);
        const status = await client.qrLabelsStatus(requestId);
        if (status.status === 'READY' && status.url) {
          window.location.assign(status.url);
          setState('idle');
          return;
        }
      }
      setState('timeout');
    } catch {
      setState('failed');
    }
  };

  return (
    <span className="flex flex-col items-start gap-1">
      <Button
        type="button"
        variant="secondary"
        // Long labels ("Nhãn QR cho 9 sản phẩm…") wrap on a 360 px phone (GH#257).
        className="h-auto min-h-11 whitespace-normal py-2 text-left"
        disabled={state === 'busy' || productIds.length === 0}
        onClick={() => void run()}
      >
        {state === 'busy' ? t('preparing') : label}
      </Button>
      {state === 'failed' || state === 'timeout' ? (
        <span role="alert" className="text-small text-seal">
          {t(state)}
        </span>
      ) : (
        <span className="text-small text-ash">{t('hint')}</span>
      )}
    </span>
  );
}
