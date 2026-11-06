import type { EntityManager } from '@mikro-orm/core';
import { Household } from '../entities/household.entity.js';
import { News } from '../entities/news.entity.js';
import { Product } from '../entities/product.entity.js';
import type { KnowledgeSourceType } from './knowledge-events.js';

/** A public document for the assistant's index; same shape as `@vcraft/knowledge`'s `KnowledgeDocument`. */
export interface PublicKnowledgeDocument {
  sourceType: KnowledgeSourceType;
  sourceId: string;
  locale: 'vi' | 'en';
  url: string;
  title: string;
  text: string;
  sourceUpdatedAt: Date;
}

const vnd = new Intl.NumberFormat('vi-VN');

/**
 * The knowledge documents for one source, or none when it is not public. Only public content is ever
 * indexed (BR-02): a PUBLISHED product of an APPROVED household, an APPROVED household's profile, and a
 * PUBLISHED news item with PUBLIC visibility (whose household, if any, is APPROVED). Content is
 * Vietnamese; the multilingual embedding model answers English questions from it too (ADR-19).
 */
export async function publicDocuments(
  em: EntityManager,
  sourceType: KnowledgeSourceType,
  sourceId: string,
  now = new Date(),
): Promise<PublicKnowledgeDocument[]> {
  if (sourceType === 'PRODUCT') {
    const p = await em.findOne(
      Product,
      { id: sourceId, status: 'PUBLISHED', household: { status: 'APPROVED' } },
      { populate: ['household'] },
    );
    if (!p) return [];
    const facts = [
      p.priceVnd > 0 ? `Giá: ${vnd.format(p.priceVnd)} đồng.` : 'Giá: liên hệ báo giá.',
      `Còn lại: ${p.stock}.`,
      p.material ? `Chất liệu: ${p.material}.` : '',
      p.dimensions ? `Kích thước: ${p.dimensions}.` : '',
      `Mã truy xuất: ${p.traceCode}.`,
    ].filter(Boolean);
    return [
      {
        sourceType,
        sourceId,
        locale: 'vi',
        url: `/vi/san-pham/${p.slug}`,
        title: `${p.name} (${p.household.name})`,
        text: [p.description, facts.join(' '), p.artisanNote ?? ''].filter(Boolean).join('\n\n'),
        sourceUpdatedAt: p.updatedAt,
      },
    ];
  }
  if (sourceType === 'HOUSEHOLD') {
    const h = await em.findOne(Household, { id: sourceId, status: 'APPROVED' });
    if (!h) return [];
    const facts = [
      h.craft ? `Nghề: ${h.craft}.` : '',
      h.village ? `Địa chỉ: ${h.village}.` : '',
      h.foundedYear ? `Thành lập năm ${h.foundedYear}.` : '',
      h.generations ? `${h.generations} đời làm nghề.` : '',
    ].filter(Boolean);
    const timeline = (h.timeline ?? []).map((e) => `${e.year}: ${e.title}. ${e.text}`.trim());
    return [
      {
        sourceType,
        sourceId,
        locale: 'vi',
        url: `/vi/nghe-nhan/${h.slug}`,
        title: h.name,
        text: [h.history, facts.join(' '), timeline.join('\n')].filter(Boolean).join('\n\n'),
        sourceUpdatedAt: h.updatedAt,
      },
    ];
  }
  const n = await em.findOne(
    News,
    {
      id: sourceId,
      status: 'PUBLISHED',
      visibility: 'PUBLIC',
      publishedAt: { $lte: now },
      $or: [{ household: null }, { household: { status: 'APPROVED' } }],
    },
    {},
  );
  if (!n) return [];
  return [
    {
      sourceType,
      sourceId,
      locale: 'vi',
      url: `/vi/tin-tuc/${n.slug}`,
      title: n.title,
      text: [n.summary, n.body].join('\n\n'),
      sourceUpdatedAt: n.updatedAt,
    },
  ];
}
