'use client';

import type { StudioClient } from '@vcraft/api-client';
import type { PriceSuggestionDto } from '@vcraft/contracts';
import type { ProductCategory } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import { useFormatter, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

/**
 * FR-PRD-07: the median price of published products in the same category, with how many it is based on.
 * It is only a hint: the price field changes when the household presses "Use this price". Hidden while
 * loading, when the API has fewer than 3 comparable products, and when the request fails.
 */
export function PriceSuggestionHint({
  client,
  category,
  onUse,
}: {
  client: StudioClient;
  category: ProductCategory;
  onUse: (priceVnd: number) => void;
}) {
  const t = useTranslations('studio.products');
  const format = useFormatter();
  const [result, setResult] = useState<PriceSuggestionDto | null>(null);
  useEffect(() => {
    let current = true;
    setResult(null);
    (async () => {
      try {
        const next = await client.getPriceSuggestion(category);
        if (current) setResult(next);
      } catch {
        // A missing hint never blocks editing the price.
      }
    })();
    return () => {
      current = false;
    };
  }, [client, category]);

  if (!result || result.category !== category || !result.suggestion) return null;
  const { medianVnd, count } = result.suggestion;
  return (
    <div className="flex flex-col items-start gap-1 text-small" data-testid="price-suggestion">
      <p className="text-ash">
        {t('priceSuggestion', { price: format.number(medianVnd, 'vnd'), count })}
      </p>
      <Button type="button" variant="secondary" size="sm" onClick={() => onUse(medianVnd)}>
        {t('priceSuggestionUse')}
      </Button>
    </div>
  );
}
