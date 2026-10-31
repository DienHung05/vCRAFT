'use client';

import type { StudioClient } from '@vcraft/api-client';
import { PRODUCT_STATUSES, type ProductStatus } from '@vcraft/domain';
import { Badge, buttonVariants, cn } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useState } from 'react';
import { Link } from '@/i18n/navigation';
import { HouseholdGate } from './household-gate';

/** Danh sách sản phẩm của hộ, lọc nháp / đang trưng bày / đã rút (FR-PRD-01). */
export function ProductList({ client }: { client?: StudioClient }) {
  const t = useTranslations('studio.products');
  const common = useTranslations('common');
  const format = useFormatter();
  const [filter, setFilter] = useState<ProductStatus | 'ALL'>('ALL');
  return (
    <HouseholdGate client={client}>
      {({ household }) => {
        const products = household.products.filter((p) => filter === 'ALL' || p.status === filter);
        return (
          <div className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12">
            <header className="flex flex-wrap items-center justify-between gap-4">
              <h1 className="text-h1">{t('title')}</h1>
              <Link href="/studio/san-pham/moi" className={buttonVariants({})}>
                {t('add')}
              </Link>
            </header>
            <fieldset className="flex flex-wrap gap-2">
              <legend className="sr-only">{t('filterLabel')}</legend>
              {(['ALL', ...PRODUCT_STATUSES] as const).map((status) => (
                <label
                  key={status}
                  className={cn(
                    'cursor-pointer rounded-chip border border-ink/15 px-3 py-1.5 text-small has-checked:bg-clay/12 has-checked:text-clay',
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
              <p className="text-ash">{t('empty')}</p>
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
