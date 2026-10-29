'use client';

import { assembleCooperativeQuotation, isCompletionDateValid } from '@vcraft/domain';
import { Button, Card, Crackle, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useId, useMemo, useState } from 'react';

const STEP = 10;

/** Đóng góp riêng của một hộ (đề xuất tham gia), như Admin nhìn thấy trên bảng chia đơn. */
export interface BoardContribution {
  householdId: string;
  /** Tên hộ hiển thị. */
  name: string;
  /** Màu nhận diện của hộ trên thanh "khối đất" (màu ảnh chủ đạo). */
  tint: string;
  /** Mức tối đa hộ khai. */
  maxQuantity: number;
  /** Đơn giá hộ khai (VND) — thông tin nội bộ, không bao giờ hiện cho bên mua. */
  unitPriceVnd: number;
  /** Ngày hoàn thành hộ hứa, tuyệt đối (ISO). Không suy ra từ số ngày. */
  completionDate: string;
  /** Phiên bản đóng góp để gửi kèm phần chia (If-Match của đóng góp). */
  contributionVersion: number;
}

/** Một phần của bản chào giá liên kết gửi đi, đúng hình dạng backend cần. */
export interface BoardQuotationPart {
  householdId: string;
  quantity: number;
  unitPriceVnd: number;
  /** ISO của ngày hoàn thành tuyệt đối. */
  completionDate: string;
  contributionVersion: number;
}

export interface BoardSubmitPayload {
  /** Phiên bản yêu cầu tại lúc gửi (If-Match của RFQ). */
  requestVersion: number;
  parts: readonly BoardQuotationPart[];
  additionalChargeVnd: number;
  deliveryTerms: 'INCLUDED' | 'SEPARATE';
}

export interface AllocationBoardProps {
  rfqId: string;
  /** Mã yêu cầu chỉ để hiển thị. */
  rfqCode: string;
  requestVersion: number;
  quantity: number;
  unit: string;
  /** Hạn chào giá: ngày hoàn thành của mọi phần phải sau mốc này. */
  biddingClosesAt: string;
  requiredBy: string;
  contributions: readonly BoardContribution[];
  /** Giá trị nháp khởi điểm (khôi phục bản soạn); không có thì bắt đầu bằng 0 — không tự đề xuất. */
  initialQuantities?: readonly number[];
  /**
   * Gửi bản chào giá liên kết. API caller truyền mutation ở đây (kèm token của phiên);
   * không truyền thì bảng chỉ mô phỏng cục bộ và ghi nhãn rõ ràng.
   */
  disabled?: boolean;
  onSubmit?: (payload: BoardSubmitPayload) => Promise<void>;
}

type SubmitState =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'sent' }
  | { kind: 'error'; message: string };

/**
 * Bảng Chia đơn thủ công (GH#10, BRAND §6.3 #9 "Chia đơn như chia đất"): thanh tổng là một khối đất
 * chia thành đoạn theo hộ; Admin tự chia tay, không có phương án tự động và không có ngày hoàn thành
 * suy đoán — từng hộ giữ đúng ngày hoàn thành và đơn giá hộ đã khai (không thể viết lại). Σ phải
 * đúng bằng số lượng yêu cầu; hộ vượt mức tối đa khai thì bị tô đỏ. Ngày hoàn thành của mỗi phần là
 * ngày tuyệt đối của hộ, phải sau hạn chào giá và không muộn hơn hạn giao. Kiểm cục bộ bằng
 * `assembleCooperativeQuotation` của domain — cùng hàm backend dùng khi cưỡng chế.
 */
export function AllocationBoard({
  rfqId,
  rfqCode,
  requestVersion,
  quantity,
  unit,
  biddingClosesAt,
  requiredBy,
  contributions,
  initialQuantities,
  onSubmit,
  disabled = false,
}: AllocationBoardProps) {
  const t = useTranslations('admin.board');
  const format = useFormatter();
  const groupId = useId();
  const [quantities, setQuantities] = useState<string[]>(() =>
    contributions.map((_, i) => {
      const v = initialQuantities?.[i];
      return v === undefined ? '0' : String(v);
    }),
  );
  const [additionalCharge, setAdditionalCharge] = useState('0');
  const [deliveryTerms, setDeliveryTerms] = useState<'INCLUDED' | 'SEPARATE'>('INCLUDED');
  const [submit, setSubmit] = useState<SubmitState>({ kind: 'idle' });

  const parsed = useMemo(
    () =>
      quantities.map((raw) => {
        // Không làm tròn âm thầm: '1000.5' hay '-5' là phần sai, không phải phần 1000 hay 5.
        const n = raw.trim() === '' ? NaN : Number(raw);
        return Number.isSafeInteger(n) && n >= 0 ? n : null;
      }),
    [quantities],
  );

  const closing = useMemo(() => new Date(biddingClosesAt), [biddingClosesAt]);
  const deadline = useMemo(() => new Date(requiredBy), [requiredBy]);

  const parts = useMemo(
    () =>
      contributions
        .map((c, i) => ({
          householdId: c.householdId,
          quantity: parsed[i] ?? 0,
          unitPriceVnd: c.unitPriceVnd,
          completionDate: c.completionDate,
          contributionVersion: c.contributionVersion,
        }))
        .filter((part) => part.quantity !== 0),
    [contributions, parsed],
  );

  const datesValid = useMemo(
    () =>
      parts.every((part) => {
        const d = new Date(part.completionDate);
        return !Number.isNaN(d.getTime()) && isCompletionDateValid(d, closing, deadline);
      }),
    [parts, closing, deadline],
  );

  const assembled = useMemo(() => {
    const result = assembleCooperativeQuotation({
      requiredQuantity: quantity,
      biddingClosesAt: closing,
      requiredBy: deadline,
      contributions: contributions.map((c) => ({
        householdId: c.householdId,
        maxQuantity: c.maxQuantity,
        unitPriceVnd: c.unitPriceVnd,
        completionDate: new Date(c.completionDate),
        version: c.contributionVersion,
      })),
      parts: parts.map((p) => ({ ...p, completionDate: new Date(p.completionDate) })),
      additionalChargeVnd: additionalCharge.trim() === '' ? NaN : Number(additionalCharge),
      deliveryTerms,
    });
    return result.ok ? result.value : null;
  }, [additionalCharge, closing, contributions, deadline, deliveryTerms, parts, quantity]);

  const sum = parsed.reduce<number>((acc, q) => acc + (q ?? 0), 0);
  const remaining = quantity - sum;
  const anyInvalid = parsed.some((q) => q === null);
  const over = new Set(
    contributions.flatMap((c, i) => {
      const q = parsed[i];
      return q !== undefined && q !== null && q > c.maxQuantity ? [i] : [];
    }),
  );
  const ready = assembled !== null && datesValid && !anyInvalid && !disabled;
  const demo = onSubmit === undefined;

  const setPart = (index: number, raw: string) => {
    if (submit.kind === 'sending' || submit.kind === 'sent') return;
    setQuantities((prev) => prev.map((q, i) => (i === index ? raw : q)));
    setSubmit({ kind: 'idle' });
  };

  const send = async () => {
    if (!ready || !assembled || submit.kind === 'sending' || submit.kind === 'sent') return;
    if (!onSubmit) {
      // Mô phỏng cục bộ: không có callback, không gọi API, không lưu.
      setSubmit({ kind: 'sent' });
      return;
    }
    setSubmit({ kind: 'sending' });
    try {
      await onSubmit({
        requestVersion,
        parts,
        additionalChargeVnd: assembled.additionalChargeVnd,
        deliveryTerms,
      });
      setSubmit({ kind: 'sent' });
    } catch (error) {
      setSubmit({
        kind: 'error',
        message: error instanceof Error ? error.message : t('sendFailed'),
      });
    }
  };

  const money = (v: number) => format.number(v, 'vnd');
  const num = (v: number) => format.number(v);
  const barTotal = Math.max(quantity, sum);
  const total =
    assembled !== null
      ? assembled.totalVnd
      : parts.reduce((acc, p) => acc + p.quantity * p.unitPriceVnd, 0);

  const problems: string[] = [];
  if (remaining > 0) problems.push(t('problem.short', { count: num(remaining), unit }));
  if (remaining < 0) problems.push(t('problem.excess', { count: num(-remaining), unit }));
  for (const i of over) {
    const c = contributions[i];
    if (c) problems.push(t('problem.over', { name: c.name, capacity: num(c.maxQuantity) }));
  }
  if (anyInvalid) problems.push(t('problem.invalid'));
  if (!datesValid) problems.push(t('problem.date'));
  if (assembled === null && !anyInvalid && !over.size && remaining === 0 && datesValid) {
    problems.push(t('problem.charge'));
  }

  return (
    <div className="flex flex-col gap-8">
      {/* Khối đất: thanh tổng chia thành đoạn theo hộ. Sai tổng ⇒ men rạn đỏ phủ lên. */}
      <section aria-labelledby={`${groupId}-bar`} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${groupId}-bar`} className="font-sans text-body font-semibold text-ink">
            {t('barTitle', { quantity: num(quantity), unit })}
          </h2>
          <p className="font-mono text-small tabular-nums text-ash">
            {num(sum)} / {num(quantity)}
          </p>
        </div>
        <div
          role="img"
          aria-label={t('barLabel', { sum: num(sum), quantity: num(quantity), unit })}
          className={cn(
            'relative flex h-16 overflow-hidden rounded-card bg-ink/6 ring-1 transition-[box-shadow] duration-(--duration-base)',
            ready ? 'ring-ink/10' : 'ring-2 ring-seal',
          )}
        >
          {contributions.map((c, i) => {
            const q = parsed[i] ?? 0;
            const width = (q / barTotal) * 100;
            return (
              <div
                key={c.householdId}
                className={cn(
                  'relative flex min-w-0 items-center justify-center overflow-hidden border-paper/70 border-r px-2 text-small text-paper transition-[width] duration-(--duration-base) ease-clay motion-reduce:transition-none',
                  over.has(i) && 'outline-2 -outline-offset-2 outline-seal',
                )}
                style={{ width: `${width}%`, background: c.tint }}
              >
                {width > 9 ? (
                  <span className="truncate font-medium drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]">
                    {c.name} · {num(q)}
                  </span>
                ) : null}
              </div>
            );
          })}
          {/* Chỗ còn thiếu hiện như đất chưa chia: sọc mảnh. */}
          {remaining > 0 ? (
            <div
              aria-hidden="true"
              className="flex-1 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--color-ink)_10%,transparent)_6px_8px)]"
            />
          ) : null}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 bg-seal/10 text-seal transition-opacity duration-(--duration-base) motion-reduce:transition-none',
              ready ? 'opacity-0' : 'opacity-100',
            )}
          >
            <Crackle opacity={0.7} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-small text-ash" aria-hidden="true">
          {contributions.map((c) => (
            <li key={c.householdId} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: c.tint }} />
              {c.name}
            </li>
          ))}
        </ul>
        <p
          aria-live="polite"
          className={cn('text-small', ready ? 'text-ink/85' : 'font-medium text-seal')}
        >
          {ready
            ? t('statusOk', { quantity: num(quantity), unit })
            : problems.length > 0
              ? problems.join(' ')
              : t('problem.short', { count: num(remaining), unit })}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="flex flex-col gap-3">
          {contributions.map((c, i) => {
            const q = parsed[i];
            const bad = over.has(i) || q === null;
            return (
              <li
                key={c.householdId}
                className={cn(
                  'grid gap-x-6 gap-y-3 rounded-card bg-surface p-4 ring-1 transition-[box-shadow,background-color] duration-(--duration-quick) md:grid-cols-[1fr_auto]',
                  bad ? 'bg-seal/5 ring-2 ring-seal' : 'ring-ink/8',
                )}
              >
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="size-3 rounded-sm"
                      style={{ background: c.tint }}
                    />
                    <span className="font-medium text-ink">{c.name}</span>
                  </div>
                  <p className="text-small text-ash">
                    {t('partMeta', {
                      max: num(c.maxQuantity),
                      price: money(c.unitPriceVnd),
                      date: format.dateTime(new Date(c.completionDate), 'short'),
                    })}
                  </p>
                  {over.has(i) ? (
                    <p className="text-small font-medium text-seal">
                      {t('problem.over', { name: c.name, capacity: num(c.maxQuantity) })}
                    </p>
                  ) : null}
                  {q === null ? (
                    <p className="text-small font-medium text-seal">{t('problem.invalid')}</p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={c.maxQuantity}
                    step={STEP}
                    value={q ?? 0}
                    disabled={submit.kind === 'sending' || submit.kind === 'sent'}
                    aria-label={t('slider', { name: c.name })}
                    onChange={(e) => setPart(i, e.currentTarget.value)}
                    className={cn(
                      'h-2 w-full min-w-32 md:w-56',
                      bad ? 'accent-seal' : 'accent-clay',
                    )}
                  />
                  <input
                    type="number"
                    min={0}
                    step={1}
                    inputMode="numeric"
                    value={quantities[i] ?? '0'}
                    disabled={submit.kind === 'sending' || submit.kind === 'sent'}
                    aria-label={t('quantityOf', { name: c.name })}
                    aria-invalid={bad}
                    onChange={(e) => setPart(i, e.currentTarget.value)}
                    className={cn(
                      'h-10 w-24 rounded-input border bg-paper px-2 text-right tabular-nums',
                      bad ? 'border-seal text-seal' : 'border-ink/20',
                    )}
                  />
                </div>
              </li>
            );
          })}
        </ul>

        <Card className="flex h-fit flex-col gap-4 p-5">
          <dl className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-3 text-small">
            <dt className="text-ash">{t('stat.sum')}</dt>
            <dd className="text-right tabular-nums">
              {num(sum)} {unit}
            </dd>
            <dt className="text-ash">{remaining < 0 ? t('stat.excess') : t('stat.missing')}</dt>
            <dd
              className={cn(
                'text-right tabular-nums',
                remaining !== 0 && 'font-semibold text-seal',
              )}
            >
              {num(Math.abs(remaining))} {unit}
            </dd>
            <dt className="text-ash">{t('stat.charge')}</dt>
            <dd>
              <input
                type="number"
                min={0}
                step={1000}
                inputMode="numeric"
                value={additionalCharge}
                disabled={submit.kind === 'sending' || submit.kind === 'sent'}
                aria-label={t('chargeOf')}
                onChange={(e) => {
                  setAdditionalCharge(e.currentTarget.value);
                  setSubmit({ kind: 'idle' });
                }}
                className="h-9 w-28 rounded-input border border-ink/20 bg-paper px-2 text-right tabular-nums"
              />
            </dd>
            <dt className="text-ash">{t('stat.terms')}</dt>
            <dd className="col-span-1 flex flex-col gap-1">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${groupId}-terms`}
                  value="INCLUDED"
                  checked={deliveryTerms === 'INCLUDED'}
                  disabled={submit.kind === 'sending' || submit.kind === 'sent'}
                  onChange={() => {
                    setDeliveryTerms('INCLUDED');
                    setSubmit({ kind: 'idle' });
                  }}
                  className="accent-clay"
                />
                {t('terms.included')}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${groupId}-terms`}
                  value="SEPARATE"
                  checked={deliveryTerms === 'SEPARATE'}
                  disabled={submit.kind === 'sending' || submit.kind === 'sent'}
                  onChange={() => {
                    setDeliveryTerms('SEPARATE');
                    setSubmit({ kind: 'idle' });
                  }}
                  className="accent-clay"
                />
                {t('terms.separate')}
              </label>
            </dd>
            <dt className="text-ash">{t('stat.total')}</dt>
            <dd className="text-right font-semibold tabular-nums">{money(total)}</dd>
          </dl>
          <div className="flex flex-col gap-2">
            <Button
              disabled={!ready || submit.kind === 'sending' || submit.kind === 'sent'}
              onClick={send}
            >
              {submit.kind === 'sending'
                ? t('sendingLabel')
                : submit.kind === 'sent'
                  ? demo
                    ? t('sentLabel')
                    : t('sentRealLabel')
                  : t('send')}
            </Button>
            {submit.kind === 'error' ? (
              <p role="alert" className="text-small font-medium text-seal">
                {submit.message}
              </p>
            ) : null}
            {!ready && submit.kind !== 'sent' ? (
              <p className="text-[0.75rem] text-ash">{t('sendBlocked')}</p>
            ) : null}
            <p className="text-[0.75rem] text-ash">
              {demo ? t('demoNote') : t('liveNote', { code: rfqCode })}
            </p>
          </div>
        </Card>
      </div>

      {submit.kind === 'sent' ? (
        <section
          aria-live="polite"
          className="relative flex items-center gap-5 overflow-hidden rounded-card bg-surface p-6 shadow-warm"
        >
          <Crackle className="text-glaze" />
          <div className="relative">
            <h2 className="text-h3 text-ink">{demo ? t('sent.title') : t('sentReal.title')}</h2>
            <p className="mt-1 text-ink/85">
              {demo ? t('sent.text', { code: rfqId }) : t('sentReal.text', { code: rfqCode })}
            </p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
