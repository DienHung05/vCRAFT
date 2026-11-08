'use client';

import { type ChainEntry, type ChainFailureReason, verifyChain } from '@vcraft/domain';
import { Badge, Crackle, cn, SealStamp, stampShakeClass } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { LogStage } from '@/lib/demo/data';

type State =
  | { status: 'checking' }
  | { status: 'empty' }
  | { status: 'unavailable' }
  | { status: 'ok'; count: number }
  | { status: 'broken'; index: number; reason: ChainFailureReason };

export interface ChainVerifierProps {
  productId: string;
  entries: readonly (ChainEntry & { stage: LogStage })[];
  /** Hộ làm ra sản phẩm, dùng cho câu "mã này khớp với…". */
  household: string;
  /** The management board approved the household (FR-TRC-04); shown as a badge beside the seal. */
  householdVerified?: boolean;
  /** `SubtleCrypto` thay thế, chỉ để kiểm thử. Mặc định là Web Crypto của trình duyệt. */
  subtle?: SubtleCrypto;
}

/**
 * Tự kiểm chứng chuỗi băm nhật ký ngay trên trình duyệt (FR-TRC-05, BR-01) và hiện đúng kết quả:
 * đang kiểm, toàn vẹn, hoặc có mốc bị sửa. Ấn son (BRAND §6.3 #2) chỉ đóng khi chuỗi thật sự khớp.
 * Dữ liệu hiện là dữ liệu minh họa nên luôn kèm nhãn; và toàn vẹn chuỗi không chứng minh điều ghi
 * trong nhật ký là đúng ngoài đời.
 */
export function ChainVerifier({
  productId,
  entries,
  household,
  householdVerified = false,
  subtle,
}: ChainVerifierProps) {
  const t = useTranslations('trace.integrity');
  const stages = useTranslations('stages');
  const [state, setState] = useState<State>(
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

  const broken = state.status === 'broken';
  const title =
    state.status === 'ok'
      ? t('okTitle')
      : state.status === 'broken'
        ? t('brokenTitle')
        : state.status === 'unavailable'
          ? t('unavailableTitle')
          : state.status === 'empty'
            ? t('emptyTitle')
            : t('checkingTitle');

  return (
    <section
      aria-labelledby="verify-title"
      data-state={state.status}
      className={cn(
        'relative mx-5 mt-8 overflow-hidden rounded-card bg-surface p-6 shadow-warm',
        broken && 'border border-seal/60',
        state.status === 'ok' && stampShakeClass(),
      )}
    >
      <Crackle className={broken ? 'text-seal' : 'text-glaze'} opacity={broken ? 0.3 : 0.18} />
      <div className="relative flex items-center gap-5">
        {state.status === 'ok' ? (
          <SealStamp size={64} title={t('okTitle')} />
        ) : (
          <span
            aria-hidden="true"
            className={cn(
              'grid size-16 shrink-0 place-items-center rounded-card border-2 border-dashed text-h3',
              broken ? 'border-seal text-seal' : 'border-ash/50 text-ash',
              state.status === 'checking' && 'animate-pulse motion-reduce:animate-none',
            )}
          >
            {broken ? '!' : '?'}
          </span>
        )}
        <div>
          <div role="status" aria-live="polite">
            <h2 id="verify-title" className={cn('text-h3', broken ? 'text-seal' : 'text-ink')}>
              {title}
            </h2>
            <p className="mt-1 text-small text-ink/85">
              {state.status === 'ok'
                ? t('okText', { count: state.count })
                : state.status === 'checking'
                  ? t('checkingText')
                  : state.status === 'unavailable'
                    ? t('unavailableText')
                    : state.status === 'empty'
                      ? t('emptyText')
                      : t(`reason.${state.reason}`)}
            </p>
            {state.status === 'broken' ? (
              <p className="mt-1 text-small font-medium text-seal">
                {t('brokenAt', {
                  n: state.index + 1,
                  stage: stages(`${entries[state.index]?.stage ?? 'clay'}.name` as const),
                })}{' '}
                <a href={`#log-${state.index + 1}`} className="underline underline-offset-2">
                  {t('brokenLink', { n: state.index + 1 })}
                </a>
              </p>
            ) : null}
          </div>
          {/* Câu cố định cạnh ấn (vCRAFT-9hg.4): nói rõ "Toàn vẹn nhật ký" bảo đảm gì và không bảo đảm gì. */}
          <p className="mt-3 text-small text-ink/85">{t('sentence')}</p>
        </div>
      </div>

      <div className="relative mt-5 flex flex-wrap gap-2">
        {householdVerified ? <Badge tone="celadon">✓ {t('householdVerified')}</Badge> : null}
        {state.status === 'ok' ? (
          <Badge tone="celadon">✓ {t('okBadge', { count: state.count })}</Badge>
        ) : null}
      </div>
      <p className="relative mt-4 text-small text-ink/85">{t('match', { household })}</p>
    </section>
  );
}
