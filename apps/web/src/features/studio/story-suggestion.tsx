'use client';

import { ApiError, type StudioClient } from '@vcraft/api-client';
import type { StorySuggestionDto } from '@vcraft/contracts';
import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';

type State = 'idle' | 'loading' | 'unavailable' | 'rateLimited' | 'failed';

/**
 * FR-ART-08: asks the API for a suggested story and its English translation, and shows them in a dialog to
 * copy or insert. A suggestion is never saved or published here: the household edits the text and saves it
 * with the story. A 503 means the chat model is not configured, so the button is disabled from then on.
 */
export function StorySuggestion({
  client,
  onInsert,
}: {
  client: StudioClient;
  onInsert: (text: string) => void;
}) {
  const t = useTranslations('studio.profile.suggest');
  const [state, setState] = useState<State>('idle');
  const [suggestion, setSuggestion] = useState<StorySuggestionDto | null>(null);
  const [copied, setCopied] = useState<'vi' | 'en' | null>(null);

  const request = async () => {
    setState('loading');
    try {
      setSuggestion(await client.storySuggestion());
      setState('idle');
    } catch (error) {
      if (error instanceof ApiError && error.status === 503) setState('unavailable');
      else if (error instanceof ApiError && error.status === 429) setState('rateLimited');
      else setState('failed');
    }
  };

  const copy = async (language: 'vi' | 'en', text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(language);
    } catch {
      setCopied(null);
    }
  };

  const message =
    state === 'unavailable'
      ? t('unavailable')
      : state === 'rateLimited'
        ? t('rateLimited')
        : state === 'failed'
          ? t('failed')
          : null;

  return (
    <div className="flex flex-col gap-2">
      <div>
        <Button
          type="button"
          variant="secondary"
          disabled={state === 'loading' || state === 'unavailable'}
          onClick={() => void request()}
        >
          {state === 'loading' ? t('busy') : t('button')}
        </Button>
      </div>
      {message ? (
        <p role="status" className="text-small text-ash">
          {message}
        </p>
      ) : null}
      <ConfirmDialog
        open={suggestion !== null}
        title={t('title')}
        confirmLabel={t('insert')}
        cancelLabel={t('close')}
        onClose={() => {
          setSuggestion(null);
          setCopied(null);
        }}
        onConfirm={() => {
          if (suggestion) onInsert(suggestion.vi);
          setSuggestion(null);
          setCopied(null);
        }}
      >
        {suggestion ? (
          <div className="flex flex-col gap-4">
            <p className="text-small text-ash">{t('lead')}</p>
            {(['vi', 'en'] as const).map((language) => (
              <section key={language} className="flex flex-col gap-1">
                <h3 className="text-small font-semibold">{t(language)}</h3>
                <p lang={language} className="whitespace-pre-line text-small">
                  {suggestion[language]}
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => void copy(language, suggestion[language])}
                  >
                    {t(language === 'vi' ? 'copyVi' : 'copyEn')}
                  </Button>
                  {copied === language ? (
                    <span role="status" className="text-small text-ash">
                      {t('copied')}
                    </span>
                  ) : null}
                </div>
              </section>
            ))}
          </div>
        ) : null}
      </ConfirmDialog>
    </div>
  );
}
