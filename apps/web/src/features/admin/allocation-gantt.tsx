'use client';

import type { AdminClient } from '@vcraft/api-client';
import type { AllocationScheduleDto } from '@vcraft/contracts';
import { Button, Card } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useCallback, useEffect, useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { ErrorState } from '@/components/states/error-state';
import { ListSkeleton } from '@/components/states/skeletons';
import { AllocationTimeline } from '@/features/orders/allocation-timeline';
import { inputClass } from '@/features/studio/workshop-editor';
import { notify } from '@/lib/notify';
import { useAdminClient } from './admin-dashboard';

type Order = AllocationScheduleDto[number];
type Share = Order['allocations'][number];

/**
 * Admin Gantt of running orders (PLAN E10): one bar per household from when its share started to the
 * date it promised, filled by what it has made, with a line for today. A share that falls behind the
 * straight-line curve or passes its date is flagged and can hand its unfinished pieces to others.
 */
export function AllocationGantt({ client: provided }: { client?: AdminClient }) {
  const t = useTranslations('admin.progress');
  const { client, loading } = useAdminClient(provided);
  const [orders, setOrders] = useState<AllocationScheduleDto | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    if (!client) return;
    try {
      setOrders(await client.allocationSchedule());
      setFailed(false);
    } catch {
      setFailed(true);
    }
  }, [client]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading || (!orders && !failed)) return <ListSkeleton label={t('loading')} />;
  if (failed || !client)
    return <ErrorState message={t('loadFailed')} onRetry={() => void load()} />;
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-h2">{t('title')}</h1>
        <p className="text-small text-ash">{t('lead')}</p>
      </header>
      {orders?.length === 0 ? (
        <EmptyState illustration="vase" title={t('empty')} />
      ) : (
        orders?.map((order) => (
          <OrderTimeline
            key={order.requestId}
            order={order}
            client={client}
            onChanged={setOrders}
          />
        ))
      )}
    </div>
  );
}

function OrderTimeline({
  order,
  client,
  onChanged,
}: {
  order: Order;
  client: AdminClient;
  onChanged: (orders: AllocationScheduleDto) => void;
}) {
  const t = useTranslations('admin.progress');
  const format = useFormatter();
  const [open, setOpen] = useState<string | null>(null);
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-h3">{order.title}</h2>
        <span className="text-small text-ash">
          {t('requiredBy', { date: format.dateTime(new Date(order.requiredBy), 'short') })}
        </span>
      </div>
      <AllocationTimeline
        shares={order.allocations}
        unit={order.unit}
        renderAction={(share) => {
          const canReallocate =
            (share.status === 'IN_PROGRESS' && ['BEHIND', 'OVERDUE'].includes(share.lateness)) ||
            (share.status === 'DECLINED' && share.quantity > 0);
          if (!canReallocate) return null;
          return open === share.id ? (
            <ReallocateForm
              share={share}
              unit={order.unit}
              client={client}
              onDone={(orders) => {
                setOpen(null);
                onChanged(orders);
              }}
              onCancel={() => setOpen(null)}
            />
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="self-start"
              onClick={() => setOpen(share.id)}
            >
              {t('reallocate')}
            </Button>
          );
        }}
      />
    </Card>
  );
}

function ReallocateForm({
  share,
  unit,
  client,
  onDone,
  onCancel,
}: {
  share: Share;
  unit: string;
  client: AdminClient;
  onDone: (orders: AllocationScheduleDto) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('admin.progress');
  const remaining = share.quantity - share.completedQty;
  const [households, setHouseholds] = useState<readonly { id: string; name: string }[]>([]);
  const [targets, setTargets] = useState([{ householdId: '', quantity: String(remaining) }]);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    client
      .listHouseholds({ status: 'APPROVED' })
      .then((rows) => setHouseholds(rows.filter((h) => h.id !== share.householdId)))
      .catch(() => setHouseholds([]));
  }, [client, share.householdId]);

  const moved = targets.reduce((sum, row) => sum + (Number(row.quantity) || 0), 0);
  const valid =
    moved === remaining &&
    targets.every(
      (row) =>
        row.householdId && Number.isInteger(Number(row.quantity)) && Number(row.quantity) > 0,
    ) &&
    new Set(targets.map((row) => row.householdId)).size === targets.length;

  const submit = async () => {
    setSending(true);
    try {
      onDone(
        await client.reallocate(share.id, share.version, {
          targets: targets.map((row) => ({
            householdId: row.householdId,
            quantity: Number(row.quantity),
          })),
        }),
      );
      notify.success(t('reallocated'));
    } catch {
      notify.error(t('reallocateFailed'));
    } finally {
      setSending(false);
    }
  };

  return (
    <fieldset className="flex flex-col gap-2 rounded-card border border-ink/10 p-3">
      <legend className="px-1 text-small font-medium">
        {t('reallocateLegend', { remaining, unit })}
      </legend>
      {targets.map((row, index) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: rows are only added and removed at the end.
        <div key={index} className="grid gap-2 sm:grid-cols-[1fr_8rem]">
          <select
            aria-label={t('targetHousehold')}
            value={row.householdId}
            onChange={(e) =>
              setTargets(
                targets.map((r, i) => (i === index ? { ...r, householdId: e.target.value } : r)),
              )
            }
            className={inputClass}
          >
            <option value="">{t('chooseHousehold')}</option>
            {households.map((h) => (
              <option key={h.id} value={h.id}>
                {h.name}
              </option>
            ))}
          </select>
          <input
            aria-label={t('targetQuantity')}
            inputMode="numeric"
            value={row.quantity}
            onChange={(e) =>
              setTargets(
                targets.map((r, i) => (i === index ? { ...r, quantity: e.target.value } : r)),
              )
            }
            className={inputClass}
          />
        </div>
      ))}
      <p role="status" className="text-small text-ash">
        {t('moved', { moved, remaining, unit })}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setTargets([...targets, { householdId: '', quantity: '0' }])}
        >
          {t('addTarget')}
        </Button>
        <Button type="button" size="sm" disabled={!valid || sending} onClick={() => void submit()}>
          {t('confirmReallocate')}
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {t('cancel')}
        </Button>
      </div>
    </fieldset>
  );
}
