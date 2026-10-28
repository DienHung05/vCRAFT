'use client';

import { checkAllocationPlan } from '@vcraft/domain';
import { Button, Card, Crackle, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useId, useMemo, useState } from 'react';
import type { AllocationStrategy } from '@/lib/demo/data';

const STRATEGIES: readonly AllocationStrategy[] = ['capacity', 'cheapest', 'balanced'];
const STEP = 10;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface AllocationPart {
  slug: string;
  name: string;
  /** Màu nhận diện của hộ trên thanh "khối đất" (màu ảnh chủ đạo, dữ liệu mẫu). */
  tint: string;
  capacity: number;
  unitPrice: number;
  leadDays: number;
}

export interface AllocationBoardProps {
  rfqCode: string;
  quantity: number;
  unit: string;
  requiredBy: string;
  parts: readonly AllocationPart[];
  /** Phương án đề xuất theo từng chiến lược (BR-06), cùng thứ tự `parts`. */
  plans: Record<AllocationStrategy, readonly number[]>;
}

type Strategy = AllocationStrategy | 'custom';

/**
 * Bảng Chia đơn (FR-ORD-03, BRAND §6.3 #9 "Chia đơn như chia đất"): thanh tổng là một khối đất chia
 * thành đoạn theo hộ; chỉnh tay bằng thanh trượt hoặc ô số; Σ sai ⇒ khối rạn đỏ (men rạn), hộ vượt
 * năng lực tô đỏ. Kiểm bất biến BR-L6 bằng `checkAllocationPlan` của domain, cùng hàm backend dùng.
 * Chuyển động chỉ phản hồi trạng thái (≤ 280ms) và tự tắt khi giảm chuyển động.
 */
export function AllocationBoard({
  rfqCode,
  quantity,
  unit,
  requiredBy,
  parts,
  plans,
}: AllocationBoardProps) {
  const t = useTranslations('admin.board');
  const format = useFormatter();
  const groupId = useId();
  const [base, setBase] = useState<AllocationStrategy>('capacity');
  const [strategy, setStrategy] = useState<Strategy>('capacity');
  const [quantities, setQuantities] = useState<number[]>(() => [...plans.capacity]);
  const [sent, setSent] = useState(false);
  const [now, setNow] = useState<number | null>(null);

  // Giờ hiện tại chỉ có sau khi hydrate (trang dựng sẵn tĩnh); trước đó chỉ hiện số ngày.
  useEffect(() => setNow(Date.now()), []);

  const check = useMemo(
    () =>
      checkAllocationPlan(
        quantity,
        parts.map((p, i) => ({ quantity: quantities[i] ?? 0, capacity: p.capacity })),
      ),
    [quantity, parts, quantities],
  );

  const cost = parts.reduce((sum, p, i) => sum + (quantities[i] ?? 0) * p.unitPrice, 0);
  const leadDays = Math.max(0, ...parts.map((p, i) => ((quantities[i] ?? 0) > 0 ? p.leadDays : 0)));
  const etaTime = now === null ? null : now + leadDays * DAY_MS;
  const onTime = etaTime === null ? null : etaTime <= new Date(requiredBy).getTime();
  const over = new Set(check.overCapacity);
  const invalid = new Set(check.invalid);

  // Mô phỏng cục bộ: chưa gọi API, chưa lưu, chưa thông báo (xem `board.demoNote`). Chặn bấm lặp.
  const simulateSend = () => {
    if (sent || !check.ok) return;
    setSent(true);
  };

  const choose = (next: AllocationStrategy) => {
    if (sent) return;
    setBase(next);
    setStrategy(next);
    setQuantities([...plans[next]]);
  };

  const setPart = (index: number, raw: number) => {
    if (sent) return;
    const value = Number.isFinite(raw) ? Math.max(0, Math.round(raw)) : 0;
    setStrategy('custom');
    setQuantities((prev) => prev.map((q, i) => (i === index ? value : q)));
  };

  const strategyCost = (s: AllocationStrategy) =>
    parts.reduce((sum, p, i) => sum + (plans[s][i] ?? 0) * p.unitPrice, 0);

  const money = (v: number) => format.number(v, 'vnd');
  const num = (v: number) => format.number(v);
  // Mẫu số của thanh: nếu chia thừa thì thanh co lại cho vừa, để thấy rõ chỗ thừa.
  const barTotal = Math.max(quantity, check.sum);

  const problems: string[] = [];
  if (check.remaining > 0) problems.push(t('problem.short', { count: num(check.remaining), unit }));
  if (check.remaining < 0)
    problems.push(t('problem.excess', { count: num(-check.remaining), unit }));
  for (const i of check.overCapacity) {
    const p = parts[i];
    if (p) problems.push(t('problem.over', { name: p.name, capacity: num(p.capacity) }));
  }
  if (check.invalid.length > 0) problems.push(t('problem.invalid'));

  return (
    <div className="flex flex-col gap-8">
      <fieldset>
        <legend className="mb-3 font-sans text-body font-semibold text-ink">
          {t('strategyTitle')}
        </legend>
        <div className="grid gap-3 md:grid-cols-3">
          {STRATEGIES.map((s) => (
            <label
              key={s}
              className={cn(
                'flex cursor-pointer flex-col gap-1 rounded-card bg-surface p-4 ring-1 ring-ink/10 transition-[box-shadow,background-color] duration-(--duration-quick)',
                'has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-glaze',
                strategy === s && 'bg-clay/8 ring-2 ring-clay',
                sent && 'cursor-not-allowed opacity-60',
              )}
            >
              <span className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`${groupId}-strategy`}
                  value={s}
                  checked={strategy === s}
                  disabled={sent}
                  onChange={() => choose(s)}
                  className="accent-clay"
                />
                <span className="font-medium text-ink">{t(`strategy.${s}.name`)}</span>
              </span>
              <span className="text-small text-ash">{t(`strategy.${s}.text`)}</span>
              <span className="mt-1 text-small tabular-nums text-ink/80">
                {t('strategyCost', { cost: money(strategyCost(s)) })}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {/* Khối đất: thanh tổng chia thành đoạn theo hộ. Sai tổng ⇒ men rạn đỏ phủ lên. */}
      <section aria-labelledby={`${groupId}-bar`} className="flex flex-col gap-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id={`${groupId}-bar`} className="font-sans text-body font-semibold text-ink">
            {t('barTitle', { quantity: num(quantity), unit })}
          </h2>
          <p className="font-mono text-small tabular-nums text-ash">
            {num(check.sum)} / {num(quantity)}
          </p>
        </div>
        <div
          role="img"
          aria-label={t('barLabel', { sum: num(check.sum), quantity: num(quantity), unit })}
          className={cn(
            'relative flex h-16 overflow-hidden rounded-card bg-ink/6 ring-1 transition-[box-shadow] duration-(--duration-base)',
            check.ok ? 'ring-ink/10' : 'ring-2 ring-seal',
          )}
        >
          {parts.map((p, i) => {
            const q = quantities[i] ?? 0;
            const width = (q / barTotal) * 100;
            return (
              <div
                key={p.slug}
                className={cn(
                  'relative flex min-w-0 items-center justify-center overflow-hidden border-paper/70 border-r px-2 text-small text-paper transition-[width] duration-(--duration-base) ease-clay motion-reduce:transition-none',
                  over.has(i) && 'outline-2 -outline-offset-2 outline-seal',
                )}
                style={{ width: `${width}%`, background: p.tint }}
              >
                {width > 9 ? (
                  <span className="truncate font-medium drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]">
                    {p.name} · {num(q)}
                  </span>
                ) : null}
              </div>
            );
          })}
          {/* Chỗ còn thiếu hiện như đất chưa chia: sọc mảnh. */}
          {check.remaining > 0 ? (
            <div
              aria-hidden="true"
              className="flex-1 bg-[repeating-linear-gradient(135deg,transparent_0_6px,color-mix(in_oklch,var(--color-ink)_10%,transparent)_6px_8px)]"
            />
          ) : null}
          <div
            aria-hidden="true"
            className={cn(
              'pointer-events-none absolute inset-0 bg-seal/10 text-seal transition-opacity duration-(--duration-base) motion-reduce:transition-none',
              check.ok ? 'opacity-0' : 'opacity-100',
            )}
          >
            <Crackle opacity={0.7} />
          </div>
        </div>
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-small text-ash" aria-hidden="true">
          {parts.map((p) => (
            <li key={p.slug} className="flex items-center gap-2">
              <span className="size-3 rounded-sm" style={{ background: p.tint }} />
              {p.name}
            </li>
          ))}
        </ul>
        <p
          aria-live="polite"
          className={cn('text-small', check.ok ? 'text-ink/85' : 'font-medium text-seal')}
        >
          {check.ok ? t('statusOk', { quantity: num(quantity), unit }) : problems.join(' ')}
        </p>
      </section>

      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <ul className="flex flex-col gap-3">
          {parts.map((p, i) => {
            const q = quantities[i] ?? 0;
            const bad = over.has(i) || invalid.has(i);
            return (
              <li
                key={p.slug}
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
                      style={{ background: p.tint }}
                    />
                    <span className="font-medium text-ink">{p.name}</span>
                  </div>
                  <p className="text-small text-ash">
                    {t('partMeta', {
                      capacity: num(p.capacity),
                      price: money(p.unitPrice),
                      days: p.leadDays,
                    })}
                  </p>
                  {over.has(i) ? (
                    <p className="text-small font-medium text-seal">
                      {t('problem.over', { name: p.name, capacity: num(p.capacity) })}
                    </p>
                  ) : null}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="range"
                    min={0}
                    max={quantity}
                    step={STEP}
                    value={q}
                    disabled={sent}
                    aria-label={t('slider', { name: p.name })}
                    onChange={(e) => setPart(i, e.currentTarget.valueAsNumber)}
                    className={cn(
                      'h-2 w-full min-w-32 md:w-56',
                      bad ? 'accent-seal' : 'accent-clay',
                    )}
                  />
                  <input
                    type="number"
                    min={0}
                    step={STEP}
                    inputMode="numeric"
                    value={q}
                    disabled={sent}
                    aria-label={t('quantityOf', { name: p.name })}
                    aria-invalid={bad}
                    onChange={(e) => setPart(i, e.currentTarget.valueAsNumber)}
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
              {num(check.sum)} {unit}
            </dd>
            <dt className="text-ash">
              {check.remaining < 0 ? t('stat.excess') : t('stat.missing')}
            </dt>
            <dd
              className={cn(
                'text-right tabular-nums',
                check.remaining !== 0 && 'font-semibold text-seal',
              )}
            >
              {num(Math.abs(check.remaining))} {unit}
            </dd>
            <dt className="text-ash">{t('stat.cost')}</dt>
            <dd className="text-right font-semibold tabular-nums">{money(cost)}</dd>
            <dt className="text-ash">{t('stat.average')}</dt>
            <dd className="text-right tabular-nums">
              {check.sum > 0 ? money(Math.round(cost / check.sum)) : '–'}
            </dd>
            <dt className="text-ash">{t('stat.eta')}</dt>
            <dd className="text-right tabular-nums">
              {leadDays > 0 ? t('stat.etaDays', { days: leadDays }) : '–'}
              {etaTime !== null && leadDays > 0 ? (
                <span className="block text-ash">
                  {format.dateTime(new Date(etaTime), 'short')}
                </span>
              ) : null}
            </dd>
          </dl>
          {onTime !== null && leadDays > 0 ? (
            <p className={cn('text-small', onTime ? 'text-ink/80' : 'font-medium text-seal')}>
              {onTime
                ? t('stat.onTime', { date: format.dateTime(new Date(requiredBy), 'short') })
                : t('stat.late', { date: format.dateTime(new Date(requiredBy), 'short') })}
            </p>
          ) : null}
          <div className="flex flex-col gap-2">
            <Button disabled={!check.ok || sent} onClick={simulateSend}>
              {sent ? t('sentLabel') : t('send')}
            </Button>
            <Button
              variant="secondary"
              disabled={
                sent || (strategy === base && quantities.every((q, i) => q === plans[base][i]))
              }
              onClick={() => choose(base)}
            >
              {t('reset')}
            </Button>
            {!check.ok && !sent ? (
              <p className="text-[0.75rem] text-ash">{t('sendBlocked')}</p>
            ) : null}
            <p className="text-[0.75rem] text-ash">{t('demoNote')}</p>
          </div>
        </Card>
      </div>

      {sent ? (
        <section
          aria-live="polite"
          className="relative flex items-center gap-5 overflow-hidden rounded-card bg-surface p-6 shadow-warm"
        >
          <Crackle className="text-glaze" />
          <div className="relative">
            <h2 className="text-h3 text-ink">{t('sent.title')}</h2>
            <p className="mt-1 text-ink/85">{t('sent.text', { code: rfqCode })}</p>
          </div>
        </section>
      ) : null}
    </div>
  );
}
