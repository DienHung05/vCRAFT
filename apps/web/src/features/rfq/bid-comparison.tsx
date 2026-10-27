'use client';

import { Badge, Button, cn, spring, staggerDelay, useReducedMotion } from '@vcraft/ui';
import { AnimatePresence, motion } from 'motion/react';
import { useFormatter, useTranslations } from 'next-intl';
import { type ReactNode, useId, useMemo, useState } from 'react';
import type { Bid } from '@/lib/demo/data';

type SortKey = 'unitPrice' | 'total' | 'coverage' | 'delivery' | 'reputation';
type SortDir = 'asc' | 'desc';

const SORT_KEYS: readonly SortKey[] = ['unitPrice', 'total', 'coverage', 'delivery', 'reputation'];

/** Hướng "tốt hơn" của từng tiêu chí; cũng là hướng sắp xếp mặc định khi bấm lần đầu. */
const BEST_DIR: Record<SortKey, SortDir> = {
  unitPrice: 'asc',
  total: 'asc',
  coverage: 'desc',
  delivery: 'asc',
  reputation: 'desc',
};

interface Row {
  bid: Bid;
  total: number;
  coverage: number;
  full: boolean;
  deliveryTime: number;
}

const metricOf = (row: Row, key: SortKey): number =>
  key === 'unitPrice'
    ? row.bid.unitPrice
    : key === 'total'
      ? row.total
      : key === 'coverage'
        ? row.coverage
        : key === 'delivery'
          ? row.deliveryTime
          : row.bid.reputation;

/**
 * Các bid tốt nhất theo một tiêu chí (FR-RFQ-07). Không tô khi chỉ có một ứng viên hoặc mọi giá trị
 * bằng nhau (khi đó "tốt nhất" không mang thông tin).
 */
function bestOf(rows: readonly Row[], key: SortKey): Set<string> {
  // Thành tiền chỉ so các chào giá đủ số lượng: chào một phần luôn rẻ hơn nhưng không chốt được.
  const pool = key === 'total' ? rows.filter((r) => r.full) : rows;
  if (pool.length < 2) return new Set();
  const values = pool.map((r) => metricOf(r, key));
  const target = BEST_DIR[key] === 'asc' ? Math.min(...values) : Math.max(...values);
  if (values.every((v) => v === target)) return new Set();
  return new Set(pool.filter((r) => metricOf(r, key) === target).map((r) => r.bid.id));
}

/** Ô được tô vàng sơn mài khi là lựa chọn tốt nhất theo cột; lần đầu hiện thì phát sáng một nhịp. */
function Best({ on, label, children }: { on: boolean; label: string; children: ReactNode }) {
  return on ? (
    <span className="inline-block animate-glow rounded-input bg-lacquer/14 px-2 py-0.5 font-semibold ring-1 ring-lacquer/45">
      {children}
      <span className="sr-only"> · {label}</span>
    </span>
  ) : (
    <span className="inline-block px-2 py-0.5">{children}</span>
  );
}

export interface BidComparisonProps {
  bids: readonly Bid[];
  /** Số lượng RFQ cần; chỉ bid chào đúng số này mới chốt được (FR-RFQ-08, T3). */
  quantity: number;
  unit: string;
  /** Domain cho phép Buyer chốt ở trạng thái hiện tại (`ACCEPT_BID` ∈ sự kiện hợp lệ). */
  canAccept: boolean;
  onAccept: (bid: Bid) => void;
}

/**
 * Bảng so sánh chào giá (FR-RFQ-07, BRAND §6.3 #8): sắp xếp theo cột, tô vàng sơn mài ô tốt nhất
 * ở từng cột, hàng trượt về chỗ khi đổi thứ tự. Màn hẹp đổi sang danh sách thẻ.
 */
export function BidComparison({ bids, quantity, unit, canAccept, onAccept }: BidComparisonProps) {
  const t = useTranslations('rfq.bids');
  const format = useFormatter();
  const reduced = useReducedMotion();
  const selectId = useId();
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: 'unitPrice',
    dir: 'asc',
  });

  const rows = useMemo<Row[]>(
    () =>
      bids.map((bid) => ({
        bid,
        total: bid.unitPrice * bid.quantityOffered,
        coverage: Math.round((bid.quantityOffered / quantity) * 100),
        full: bid.quantityOffered === quantity,
        deliveryTime: new Date(bid.deliveryDate).getTime(),
      })),
    [bids, quantity],
  );

  const best = useMemo(() => {
    // Chỉ chào giá còn hiệu lực mới tham gia xếp hạng "tốt nhất".
    const live = rows.filter((r) => r.bid.status === 'SUBMITTED' || r.bid.status === 'ACCEPTED');
    return Object.fromEntries(SORT_KEYS.map((key) => [key, bestOf(live, key)])) as Record<
      SortKey,
      Set<string>
    >;
  }, [rows]);

  const sorted = useMemo(() => {
    const sign = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => sign * (metricOf(a, sort.key) - metricOf(b, sort.key)));
  }, [rows, sort]);

  const layoutTransition = reduced ? { duration: 0 } : spring.clay;

  const toggleSort = (key: SortKey) =>
    setSort((s) =>
      s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: BEST_DIR[key] },
    );

  const money = (v: number) => format.number(v, 'vnd');
  const day = (iso: string) => format.dateTime(new Date(iso), 'short');

  const bidderCell = (row: Row) => (
    <div className="flex flex-col gap-1.5">
      <span className="font-medium text-ink">{row.bid.bidder}</span>
      <div className="flex flex-wrap gap-1.5">
        {row.bid.type === 'COOPERATIVE' ? <Badge tone="glaze">{t('cooperative')}</Badge> : null}
        {row.bid.revision > 1 ? (
          <Badge tone="outline">{t('revision', { n: row.bid.revision })}</Badge>
        ) : null}
        {row.bid.status !== 'SUBMITTED' ? (
          <Badge tone={row.bid.status === 'ACCEPTED' ? 'seal' : 'neutral'}>
            {t(`status.${row.bid.status}`)}
          </Badge>
        ) : null}
      </div>
      {row.bid.note ? <p className="text-small text-ash">{row.bid.note}</p> : null}
    </div>
  );

  const coverageText = (row: Row) =>
    row.full
      ? t('coverageFull')
      : t('coveragePartial', { percent: row.coverage, count: row.bid.quantityOffered });

  const acceptCell = (row: Row) => {
    if (row.bid.status !== 'SUBMITTED') return null;
    const blocked = !row.full;
    const hintId = `accept-hint-${row.bid.id}`;
    return (
      <div className="flex flex-col items-start gap-1.5">
        <Button
          size="sm"
          disabled={blocked || !canAccept}
          aria-describedby={blocked ? hintId : undefined}
          onClick={() => onAccept(row.bid)}
        >
          {t('accept')}
        </Button>
        {blocked ? (
          <span id={hintId} className="max-w-[12rem] text-[0.75rem] leading-snug text-ash">
            {t('acceptBlocked', { quantity: format.number(quantity), unit })}
          </span>
        ) : null}
      </div>
    );
  };

  if (rows.length === 0) {
    return (
      <p className="rounded-card border border-ink/15 border-dashed p-8 text-ash">{t('empty')}</p>
    );
  }

  const th = (key: SortKey, align: 'left' | 'right' = 'left') => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
        className={cn('px-3 py-3 font-medium', align === 'right' ? 'text-right' : 'text-left')}
      >
        <button
          type="button"
          onClick={() => toggleSort(key)}
          className={cn(
            'inline-flex items-center gap-1 rounded-input px-1 text-small hover:text-ink focus-visible:outline-2 focus-visible:outline-glaze',
            active ? 'text-ink' : 'text-ash',
          )}
        >
          {t(`col.${key}`)}
          <span aria-hidden="true" className="w-3 text-[0.7rem]">
            {active ? (sort.dir === 'asc' ? '▲' : '▼') : ''}
          </span>
        </button>
      </th>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Sắp xếp trên màn hẹp, nơi không có tiêu đề cột để bấm. */}
      <div className="flex items-center gap-3 md:hidden">
        <label htmlFor={selectId} className="text-small text-ash">
          {t('sortBy')}
        </label>
        <select
          id={selectId}
          value={sort.key}
          onChange={(e) => {
            const key = e.target.value as SortKey;
            setSort({ key, dir: BEST_DIR[key] });
          }}
          className="h-10 flex-1 rounded-input border border-ink/20 bg-surface px-3 text-small"
        >
          {SORT_KEYS.map((key) => (
            <option key={key} value={key}>
              {t(`col.${key}`)}
            </option>
          ))}
        </select>
      </div>

      <div className="hidden overflow-x-auto rounded-card bg-surface shadow-warm ring-1 ring-ink/5 md:block">
        <table className="w-full min-w-[56rem] border-collapse text-small">
          <caption className="sr-only">{t('caption')}</caption>
          <thead className="border-ink/10 border-b">
            <tr>
              <th scope="col" className="px-3 py-3 text-left text-small font-medium text-ash">
                {t('col.bidder')}
              </th>
              {th('unitPrice', 'right')}
              {th('total', 'right')}
              {th('coverage')}
              {th('delivery')}
              {th('reputation')}
              <th scope="col" className="px-3 py-3 text-left text-small font-medium text-ash">
                <span className="sr-only">{t('col.action')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence initial={false}>
              {sorted.map((row, i) => (
                <motion.tr
                  key={row.bid.id}
                  layout="position"
                  initial={reduced ? { opacity: 0 } : { opacity: 0, y: -14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ layout: layoutTransition, delay: reduced ? 0 : staggerDelay(i) }}
                  className={cn(
                    'border-ink/8 border-b align-top last:border-b-0',
                    row.bid.status === 'ACCEPTED' && 'bg-seal/5',
                    (row.bid.status === 'REJECTED' ||
                      row.bid.status === 'WITHDRAWN' ||
                      row.bid.status === 'LAPSED') &&
                      'opacity-60',
                  )}
                >
                  <th scope="row" className="min-w-60 px-3 py-4 text-left font-normal">
                    {bidderCell(row)}
                  </th>
                  <td className="px-3 py-4 text-right tabular-nums">
                    <Best on={best.unitPrice.has(row.bid.id)} label={t('best')}>
                      {money(row.bid.unitPrice)}
                    </Best>
                  </td>
                  <td className="px-3 py-4 text-right tabular-nums">
                    <Best on={best.total.has(row.bid.id)} label={t('best')}>
                      {money(row.total)}
                    </Best>
                  </td>
                  <td className="px-3 py-4">
                    <Best on={best.coverage.has(row.bid.id)} label={t('best')}>
                      {coverageText(row)}
                    </Best>
                  </td>
                  <td className="px-3 py-4">
                    <Best on={best.delivery.has(row.bid.id)} label={t('best')}>
                      {day(row.bid.deliveryDate)}
                    </Best>
                  </td>
                  <td className="px-3 py-4">
                    <Best on={best.reputation.has(row.bid.id)} label={t('best')}>
                      ★{' '}
                      {format.number(row.bid.reputation, {
                        minimumFractionDigits: 1,
                        maximumFractionDigits: 1,
                      })}
                    </Best>
                  </td>
                  <td className="px-3 py-4">{acceptCell(row)}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-4 md:hidden">
        {sorted.map((row) => (
          <li
            key={row.bid.id}
            className={cn(
              'flex flex-col gap-4 rounded-card bg-surface p-4 shadow-warm ring-1 ring-ink/5',
              row.bid.status === 'ACCEPTED' && 'ring-seal/40',
              (row.bid.status === 'REJECTED' ||
                row.bid.status === 'WITHDRAWN' ||
                row.bid.status === 'LAPSED') &&
                'opacity-60',
            )}
          >
            {bidderCell(row)}
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-small">
              <div>
                <dt className="text-ash">{t('col.unitPrice')}</dt>
                <dd className="tabular-nums">
                  <Best on={best.unitPrice.has(row.bid.id)} label={t('best')}>
                    {money(row.bid.unitPrice)}
                  </Best>
                </dd>
              </div>
              <div>
                <dt className="text-ash">{t('col.total')}</dt>
                <dd className="tabular-nums">
                  <Best on={best.total.has(row.bid.id)} label={t('best')}>
                    {money(row.total)}
                  </Best>
                </dd>
              </div>
              <div>
                <dt className="text-ash">{t('col.coverage')}</dt>
                <dd>
                  <Best on={best.coverage.has(row.bid.id)} label={t('best')}>
                    {coverageText(row)}
                  </Best>
                </dd>
              </div>
              <div>
                <dt className="text-ash">{t('col.delivery')}</dt>
                <dd>
                  <Best on={best.delivery.has(row.bid.id)} label={t('best')}>
                    {day(row.bid.deliveryDate)}
                  </Best>
                </dd>
              </div>
              <div>
                <dt className="text-ash">{t('col.reputation')}</dt>
                <dd>
                  <Best on={best.reputation.has(row.bid.id)} label={t('best')}>
                    ★{' '}
                    {format.number(row.bid.reputation, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}
                  </Best>
                </dd>
              </div>
            </dl>
            {acceptCell(row)}
          </li>
        ))}
      </ul>

      <p className="text-small text-ash">
        <span
          aria-hidden="true"
          className="mr-2 inline-block size-3 rounded-sm bg-lacquer/30 align-middle ring-1 ring-lacquer/45"
        />
        {t('legend')}
      </p>
    </div>
  );
}
