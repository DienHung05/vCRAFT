'use client';

import type { QuotationClient } from '@vcraft/api-client';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useRouter } from '@/i18n/navigation';

export function DuplicateRequestButton({
  requestId,
  client,
}: {
  requestId: string;
  client: QuotationClient;
}) {
  const t = useTranslations('rfq.duplicate');
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  async function duplicate() {
    setBusy(true);
    setFailed(false);
    try {
      const draft = await client.duplicateRequest(requestId);
      router.push({ pathname: '/yeu-cau-bao-gia/[code]', params: { code: draft.id } });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        className="self-start"
        disabled={busy}
        onClick={() => void duplicate()}
      >
        {t('action')}
      </Button>
      <p className="text-small text-ash">{t('hint')}</p>
      {failed ? <p role="alert">{t('failed')}</p> : null}
    </div>
  );
}
