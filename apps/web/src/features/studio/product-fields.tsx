'use client';

import type { ProductDto } from '@vcraft/contracts';
import { CreateProductRequestSchema } from '@vcraft/contracts';
import { PRODUCT_CATEGORIES, type ProductCategory } from '@vcraft/domain';
import { useTranslations } from 'next-intl';
import { inputClass } from './workshop-editor';

export interface ProductDraft {
  name: string;
  description: string;
  category: ProductCategory;
  kind: 'OBJECT' | 'BATCH';
  batchSize: string;
  priceVnd: string;
  stock: string;
  material: string;
  dimensions: string;
  weightGrams: string;
  artisanNote: string;
}

export const EMPTY_PRODUCT: ProductDraft = {
  name: '',
  description: '',
  category: 'VASE',
  kind: 'OBJECT',
  batchSize: '',
  priceVnd: '0',
  stock: '1',
  material: '',
  dimensions: '',
  weightGrams: '',
  artisanNote: '',
};

export const toProductDraft = (p: ProductDto): ProductDraft => ({
  name: p.name,
  description: p.description,
  category: p.category,
  kind: p.kind,
  batchSize: p.batchSize?.toString() ?? '',
  priceVnd: String(p.priceVnd),
  stock: String(p.stock),
  material: p.material ?? '',
  dimensions: p.dimensions ?? '',
  weightGrams: p.weightGrams?.toString() ?? '',
  artisanNote: p.artisanNote ?? '',
});

const optional = (value: string) => (value.trim() ? { value: value.trim() } : null);

/** Kiểm biểu mẫu tạo sản phẩm bằng đúng hợp đồng của API; lỗi đầu tiên hiện cho người dùng. */
export function parseNewProduct(draft: ProductDraft) {
  const material = optional(draft.material);
  const dimensions = optional(draft.dimensions);
  const note = optional(draft.artisanNote);
  return CreateProductRequestSchema.safeParse({
    name: draft.name,
    description: draft.description,
    category: draft.category,
    kind: draft.kind,
    ...(draft.kind === 'BATCH' && draft.batchSize ? { batchSize: Number(draft.batchSize) } : {}),
    priceVnd: Number(draft.priceVnd || 0),
    stock: Number(draft.stock || 0),
    ...(material && { material: material.value }),
    ...(dimensions && { dimensions: dimensions.value }),
    ...(draft.weightGrams ? { weightGrams: Number(draft.weightGrams) } : {}),
    ...(note && { artisanNote: note.value }),
  });
}

/** Các trường thông tin sản phẩm, dùng chung cho tạo mới và sửa (FR-PRD-01). */
export function ProductFields({
  draft,
  onChange,
  kindLocked = false,
}: {
  draft: ProductDraft;
  onChange: (change: Partial<ProductDraft>) => void;
  /** Loại và cỡ lô không đổi sau khi tạo (mã QR đã gắn với một vật hoặc một lô). */
  kindLocked?: boolean;
}) {
  const t = useTranslations('studio.products');
  const categories = useTranslations('catalog.categories');
  const field = (key: keyof ProductDraft, label: string, type = 'text') => (
    <label className="flex flex-col gap-1 text-small">
      {label}
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={draft[key]}
        onChange={(event) => onChange({ [key]: event.target.value })}
        className={inputClass}
      />
    </label>
  );
  return (
    <div className="flex flex-col gap-4">
      {field('name', t('name'))}
      <label className="flex flex-col gap-1 text-small">
        {t('description')}
        <textarea
          rows={4}
          value={draft.description}
          onChange={(event) => onChange({ description: event.target.value })}
          className={inputClass}
        />
      </label>
      <div className="grid gap-4 md:grid-cols-3">
        <label className="flex flex-col gap-1 text-small">
          {t('category')}
          <select
            value={draft.category}
            onChange={(event) => onChange({ category: event.target.value as ProductCategory })}
            className={inputClass}
          >
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categories(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-small">
          {t('kind')}
          <select
            value={draft.kind}
            disabled={kindLocked}
            onChange={(event) => onChange({ kind: event.target.value as ProductDraft['kind'] })}
            className={inputClass}
          >
            <option value="OBJECT">{t('kinds.OBJECT')}</option>
            <option value="BATCH">{t('kinds.BATCH')}</option>
          </select>
        </label>
        {draft.kind === 'BATCH' ? (
          <label className="flex flex-col gap-1 text-small">
            {t('batchSize')}
            <input
              type="number"
              min={2}
              disabled={kindLocked}
              value={draft.batchSize}
              onChange={(event) => onChange({ batchSize: event.target.value })}
              className={inputClass}
            />
          </label>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {field('priceVnd', t('price'), 'number')}
        {field('stock', t('stock'), 'number')}
        {field('weightGrams', t('weight'), 'number')}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {field('material', t('material'))}
        {field('dimensions', t('dimensions'))}
      </div>
      <label className="flex flex-col gap-1 text-small">
        {t('note')}
        <textarea
          rows={2}
          value={draft.artisanNote}
          onChange={(event) => onChange({ artisanNote: event.target.value })}
          className={inputClass}
        />
      </label>
    </div>
  );
}
