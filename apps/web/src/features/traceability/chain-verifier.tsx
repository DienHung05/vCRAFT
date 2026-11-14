'use client';

import { type ChainEntry, type ChainFailureReason, verifyChain } from '@vcraft/domain';
import { Badge, Crackle, cn, SealStamp, stampShakeClass } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LogStage } from '@/lib/demo/data';

export type ChainState =
  | { status: 'checking' }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'ok'; count: number }
  | { status: 'broken'; index: number; reason: ChainFailureReason };

export type VerifiableEntry = ChainEntry & { stage: LogStage };

/**
 * Re-checks the journal's chain in the browser itself (FR-TRC-05, BR-01). The result is what the page shows:
 * checking, intact, or an entry that was changed. `subtle` replaces Web Crypto for tests only.
 */
export function useChainVerification(
  productId: string,
  entries: readonly VerifiableEntry[],
  subtle?: SubtleCrypto,
): ChainState {
  const [state, setState] = useState<ChainState>(
    entries.length === 0 ? { status: 'empty' } : { status: 'checking' },
  );

  useEffect(() => {
    if (entries.length === 0) {
      setState({ status: 'empty' });
      return;
    }
    const impl = subtle ?? globalThis.crypto?.subtle;
    if (!impl) {
      setState({ status: 'unavailable' });
      return;
    }
    let cancelled = false;
    setState({ status: 'checking' });
    verifyChain(productId, entries, impl).then(
      (result) => {
        if (cancelled) return;
        setState(
          result.ok
            ? { status: 'ok', count: result.count }
            : { status: 'broken', index: result.index, reason: result.reason },
        );
      },
      () => !cancelled && setState({ status: 'unavailable' }),
    );
    return () => {
      cancelled = true;
    };
  }, [productId, entries, subtle]);

  return state;
}

/**
 * The warning shown at the top of the story card when an entry fails the check: it names the entry and links
 * to it. The red seal colour is only used here; an intact journal never gets this block.
 */
export function ChainBrokenAlert({
  state,
  entries,
}: {
  state: Extract<ChainState, { status: 'broken' }>;
  entries: readonly VerifiableEntry[];
}) {
  const t = useTranslations('trace.integrity');
  const stages = useTranslations('stages');
  return (
    <div
      role="alert"
      data-chain-alert=""
      className="relative mb-5 overflow-hidden rounded-card border border-seal/60 bg-seal/8 p-4"
    >
      <Crackle className="text-seal" opacity={0.3} />
      <div className="relative flex items-start gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-card border-2 border-dashed border-seal text-h3 text-seal"
        >
          !
        </span>
        <div>
          <h3 className="text-h3 text-seal">{t('brokenTitle')}</h3>
          <p className="mt-1 text-small text-ink/85">{t(`reason.${state.reason}`)}</p>
          <p className="mt-1 text-small font-medium text-seal">
            {t('brokenAt', {
              n: state.index + 1,
              stage: stages(`${entries[state.index]?.stage ?? 'clay'}.name` as const),
            })}{' '}
            <a href={`#log-${state.index + 1}`} className="underline underline-offset-2">
              {t('brokenLink', { n: state.index + 1 })}
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * The compact trust line at the foot of the story card: the seal and one plain sentence, the household badge,
 * and a "how is this checked" disclosure that holds the honest explanation. The seal only closes when the
 * browser really confirmed the journal (BRAND §6.3 #2). A broken journal is not shown here; see
 * `ChainBrokenAlert`.
 */
export function JourneyTrust({
  state,
  household,
  householdVerified = false,
}: {
  state: ChainState;
  household: string;
  householdVerified?: boolean | undefined;
}) {
  const t = useTranslations('trace.integrity');
  if (state.status === 'broken') return null;
  const line =
    state.status === 'ok'
      ? t('okTitle')
      : state.status === 'unavailable'
        ? t('unavailableTitle')
        : state.status === 'empty'
          ? t('emptyTitle')
          : t('checkingTitle');
  return (
    <div data-trust={state.status} className="mt-5 border-t border-ink/10 pt-4">
      <div className="flex items-center gap-3">
        {state.status === 'ok' ? (
          <span className={cn('shrink-0', stampShakeClass())}>
            <SealStamp size={36} title={t('okTitle')} />
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full border-2 border-dashed border-ash/50 text-small text-ash',
              state.status === 'checking' && 'animate-pulse motion-reduce:animate-none',
            )}
          >
            ?
          </span>
        )}
        <p role="status" aria-live="polite" className="text-small font-medium text-ink">
          {line}
        </p>
      </div>
      {householdVerified ? (
        <p className="mt-3">
          <Badge tone="celadon">✓ {t('householdVerified')}</Badge>
        </p>
      ) : null}
      <details className="mt-3 text-small text-ink/85">
        <summary className="cursor-pointer text-clay underline-offset-4 hover:underline">
          {t('howTitle')}
        </summary>
        <div className="mt-2 space-y-2">
          {state.status === 'ok' ? <p>{t('okText', { count: state.count })}</p> : null}
          {state.status === 'unavailable' ? <p>{t('unavailableText')}</p> : null}
          {state.status === 'empty' ? <p>{t('emptyText')}</p> : null}
          <p>{t('sentence')}</p>
          <p>{t('match', { household })}</p>
        </div>
      </details>
    </div>
  );
}
