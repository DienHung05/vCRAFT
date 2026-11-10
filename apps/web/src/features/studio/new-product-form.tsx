'use client';

import type { StudioClient } from '@vcraft/api-client';
import { Button, buttonVariants, Card } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { Link, useRouter } from '@/i18n/navigation';
import { notify } from '@/lib/notify';
import { useIdempotentAction } from '@/lib/use-idempotent-action';
import { HouseholdGate } from './household-gate';
import { EMPTY_PRODUCT, ProductFields, parseNewProduct } from './product-fields';

/** Tạo sản phẩm nháp rồi chuyển sang màn sửa để thêm ảnh, người làm và nhật ký. */
export function NewProductForm({ client: provided }: { client?: StudioClient }) {
  const t = useTranslations('studio.products');
  const common = useTranslations('studio');
  const nav = useTranslations('studio.nav');
  const router = useRouter();
  const [draft, setDraft] = useState(EMPTY_PRODUCT);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const createProduct = useIdempotentAction();
  return (
    <HouseholdGate client={provided}>
      {({ client, household }) =>
        // Products come once the village board has approved the household (FR-AUTH-02, GH#237).
        household.status !== 'APPROVED' ? (
          <div className="mx-auto flex max-w-editorial flex-col gap-4 px-gutter py-8 pb-24 md:pb-12">
            <h1 className="text-h1">{t('newTitle')}</h1>
            <p role="status" className="text-ash">
              {t('pendingHint')}
            </p>
            <div>
              <Link href="/studio/ho-so" className={buttonVariants({ variant: 'secondary' })}>
                {t('pendingAction')}
              </Link>
            </div>
          </div>
        ) : (
          <form
            className="mx-auto flex max-w-editorial flex-col gap-6 px-gutter py-8 pb-24 md:pb-12"
            onSubmit={async (event) => {
              event.preventDefault();
              const parsed = parseNewProduct(draft);
              if (!parsed.success) {
                setError(parsed.error.issues[0]?.message ?? common('saveFailed'));
                return;
              }
              setSaving(true);
              setError(null);
              try {
                const product = await createProduct([household.id, parsed.data], (options) =>
                  client.createProduct(parsed.data, options),
                );
                notify.success(t('createdToast'));
                router.push({ pathname: '/studio/san-pham/[id]', params: { id: product.id } });
              } catch {
                setError(common('saveFailed'));
                setSaving(false);
              }
            }}
          >
            <Breadcrumbs
              items={[
                { label: nav('home'), href: '/studio' },
                { label: t('title'), href: '/studio/san-pham' },
                { label: t('newTitle') },
              ]}
            />
            <h1 className="text-h1">{t('newTitle')}</h1>
            <Card className="p-5">
              <ProductFields
                draft={draft}
                onChange={(change) => setDraft({ ...draft, ...change })}
              />
            </Card>
            {error ? (
              <p role="alert" className="text-small text-seal">
                {error}
              </p>
            ) : null}
            <div>
              <Button type="submit" disabled={saving}>
                {t('create')}
              </Button>
            </div>
          </form>
        )
      }
    </HouseholdGate>
  );
}
