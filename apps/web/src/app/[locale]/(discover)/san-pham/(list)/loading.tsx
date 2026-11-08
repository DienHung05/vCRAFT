import { useTranslations } from 'next-intl';
import { CatalogHeader } from '@/features/catalog/catalog-header';
import { ProductGridSkeleton } from '@/features/catalog/product-card';

/** Khung chờ khi điều hướng tới danh mục, trước khi dữ liệu từ API về. */
export default function Loading() {
  const t = useTranslations('catalog');
  return (
    <div className="mx-auto max-w-editorial px-gutter pt-12 pb-block">
      <CatalogHeader />
      <div className="mt-8">
        <ProductGridSkeleton label={t('loading')} />
      </div>
    </div>
  );
}
