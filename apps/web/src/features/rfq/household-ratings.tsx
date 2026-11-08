'use client';

import { QuotationApiError, type QuotationClient } from '@vcraft/api-client';
import type { AllocationDto, HouseholdRatingDto } from '@vcraft/contracts';
import { RATING_COMMENT_MAX } from '@vcraft/domain';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { StarRatingInput } from './star-rating';

/** Households that finished a share of the order, once each, in the order they appear. */
function ratableHouseholds(shares: readonly AllocationDto[]) {
  const seen = new Map<string, string>();
  for (const share of shares)
    if (share.status === 'DONE' && !seen.has(share.householdId))
      seen.set(share.householdId, share.householdName);
  return [...seen].map(([householdId, householdName]) => ({ householdId, householdName }));
}

/**
 * After delivery the buyer rates each household that worked on the order (FR-ORD-11, BR-05): 1 to 5 stars
 * and an optional comment, saved per household and editable until the window closes.
 */
export function HouseholdRatings({
  client,
  requestId,
  shares,
  ratings,
  onSaved,
}: {
  client: QuotationClient;
  requestId: string;
  shares: readonly AllocationDto[];
  ratings: readonly HouseholdRatingDto[];
  /** Called after a rating was saved, so the page can reload the request. */
  onSaved?: () => void;
}) {
  const t = useTranslations('rating');
  const households = ratableHouseholds(shares);
  if (households.length === 0) return null;
  return (
    <section aria-labelledby="ratings-title" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="ratings-title">{t('title')}</h2>
        <p className="text-ash">{t('lead')}</p>
      </div>
      <ul className="flex flex-col gap-4" data-testid="household-ratings">
        {households.map((household) => (
          <li key={household.householdId}>
            <RatingRow
              client={client}
              requestId={requestId}
              household={household}
              saved={ratings.find((rating) => rating.householdId === household.householdId)}
              {...(onSaved ? { onSaved } : {})}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function RatingRow({
  client,
  requestId,
  household,
  saved,
  onSaved,
}: {
  client: QuotationClient;
  requestId: string;
  household: { householdId: string; householdName: string };
  saved: HouseholdRatingDto | undefined;
  onSaved?: () => void;
}) {
  const t = useTranslations('rating');
  const format = useFormatter();
  const id = useId();
  const [stars, setStars] = useState(saved?.stars ?? 0);
  const [comment, setComment] = useState(saved?.comment ?? '');
  const [status, setStatus] = useState<
    'idle' | 'saving' | 'saved' | 'needStars' | 'failed' | 'closed'
  >('idle');
  const [editableUntil, setEditableUntil] = useState(saved?.editableUntil ?? null);
  const closed =
    status === 'closed' ||
    (editableUntil !== null && new Date(editableUntil).getTime() < Date.now());

  const save = async () => {
    if (stars < 1) {
      setStatus('needStars');
      return;
    }
    setStatus('saving');
    try {
      const rating = await client.rateHousehold(requestId, household.householdId, {
        stars,
        ...(comment.trim() ? { comment: comment.trim() } : {}),
      });
      setEditableUntil(rating.editableUntil);
      setStatus('saved');
      onSaved?.();
    } catch (error) {
      setStatus(
        error instanceof QuotationApiError && error.code === 'BUSINESS_RULE_VIOLATED'
          ? 'closed'
          : 'failed',
      );
    }
  };

  const message =
    status === 'saved'
      ? t('saved')
      : status === 'needStars'
        ? t('needStars')
        : status === 'failed'
          ? t('saveFailed')
          : closed
            ? t('windowClosed')
            : null;

  return (
    <Card className="flex flex-col gap-3 p-5">
      <p className="font-medium">{household.householdName}</p>
      <StarRatingInput
        name={`${id}-stars`}
        label={t('group', { household: household.householdName })}
        value={stars}
        disabled={closed}
        onChange={(next) => {
          setStars(next);
          setStatus('idle');
        }}
      />
      <label className="flex flex-col gap-1 text-small">
        <span className="text-ash">{t('comment', { household: household.householdName })}</span>
        <textarea
          value={comment}
          rows={3}
          maxLength={RATING_COMMENT_MAX}
          disabled={closed}
          onChange={(event) => {
            setComment(event.target.value);
            setStatus('idle');
          }}
          className="rounded-input border border-ink/20 bg-surface p-3 text-body"
        />
        <span className="text-ash">{t('commentHint')}</span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          className="self-start"
          disabled={closed || status === 'saving'}
          onClick={() => void save()}
        >
          {t(status === 'saving' ? 'saving' : 'save')}
        </Button>
        {message ? (
          <p
            role={status === 'needStars' || status === 'failed' || closed ? 'alert' : 'status'}
            className={status === 'saved' ? 'text-small text-ash' : 'text-small text-seal'}
          >
            {message}
          </p>
        ) : null}
        {editableUntil && !closed ? (
          <p className="text-small text-ash">
            {t('editableUntil', { date: format.dateTime(new Date(editableUntil), 'long') })}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
