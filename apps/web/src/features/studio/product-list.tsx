'use client';

import type { StudioClient } from '@vcraft/api-client';
import { PRODUCT_STATUSES, type ProductStatus } from '@vcraft/domain';
import { Badge, Button, buttonVariants, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { EmptyState } from '@/components/states/empty-state';
import { UsdReference } from '@/components/usd-reference';
import { Link } from '@/i18n/navigation';
import { HouseholdGate } from './household-gate';
import { QrLabelsButton } from './qr-labels-button';

/** Danh sách sản phẩm của hộ, lọc nháp / đang trưng bày / đã rút (FR-PRD-01). */
export function ProductList({ client }: { client?: StudioClient }) {
  const t = useTranslations('studio.products');
  const common = useTranslations('common');
  const format = useFormatter();
  const [filter, setFilter] = useState<ProductStatus | 'ALL'>('ALL');
  return (
    <HouseholdGate client={client}>
      {({ household, client: live }) => {
        const products = household.products.filter((p) => filter === 'ALL' || p.status === filter);
        const published = household.products.filter((p) => p.status === 'PUBLISHED');
        // Only an approved household posts products (FR-AUTH-02, GH#237).
        const approved = household.status === 'APPROVED';
        return (
          <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-h1">{t('title')}</h1>
              <span className="flex flex-wrap items-start gap-3">
                {published.length > 0 ? (
                  <QrLabelsButton
                    client={live}
                    productIds={published.map((p) => p.id)}
                    label={t('labels.allPublished', { count: published.length })}
                  />
                ) : null}
                {approved ? (
                  <Link href="/studio/san-pham/moi" className={buttonVariants({})}>
                    {t('add')}
                  </Link>
                ) : null}
              </span>
            </header>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">{t('filterLabel')}</legend>
              {(['ALL', ...PRODUCT_STATUSES] as const).map((status) => (
                <label
                  key={status}
                  className={cn(
                    'cursor-pointer rounded-chip border border-ink/15 px-3 py-1.5 text-small has-checked:bg-clay/12 has-checked:text-clay-ink',
                  )}
                >
                  <input
                    type="radio"
                    name="product-status"
                    className="sr-only"
                    checked={filter === status}
                    onChange={() => setFilter(status)}
                  />
                  {status === 'ALL' ? t('all') : t(`statuses.${status}`)}
                </label>
              ))}
            </fieldset>
            {products.length === 0 ? (
              <EmptyState
                illustration="vase"
                title={t('empty')}
                description={
                  filter !== 'ALL' ? undefined : approved ? t('emptyHint') : t('pendingHint')
                }
                action={
                  filter === 'ALL' && !approved ? undefined : filter === 'ALL' ? (
                    <Link href="/studio/san-pham/moi" className={buttonVariants({})}>
                      {t('add')}
                    </Link>
                  ) : (
                    <Button type="button" variant="secondary" onClick={() => setFilter('ALL')}>
                      {t('all')}
                    </Button>
                  )
                }
              />
            ) : (
              <ul className="flex flex-col" data-testid="studio-products">
                {products.map((product) => (
                  <li key={product.id} className="border-ink/10 border-b last:border-b-0">
                    <Link
                      href={{ pathname: '/studio/san-pham/[id]', params: { id: product.id } }}
                      className="flex min-h-14 flex-wrap items-center justify-between gap-3 py-3 hover:text-clay"
                    >
                      <span className="min-w-0 font-medium">{product.name}</span>
                      <span className="flex items-center gap-3 text-small text-ash">
                        {product.priceVnd > 0
                          ? format.number(product.priceVnd, 'vnd')
                          : common('priceOnRequest')}
                        <UsdReference vnd={product.priceVnd} />
                        <Badge tone={product.status === 'PUBLISHED' ? 'lacquer' : 'outline'}>
                          {t(`statuses.${product.status}`)}
                        </Badge>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      }}
    </HouseholdGate>
  );
}
