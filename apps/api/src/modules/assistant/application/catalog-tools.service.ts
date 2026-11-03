import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { CitationDto } from '@vcraft/contracts';
import { Product, Workshop } from '@vcraft/database';
import { isVisitable, openState } from '@vcraft/domain';
import { searchTerms } from '@vcraft/utils';
import { withTimeout } from './tools';

export interface ToolResult {
  name: string;
  /** What the model reads, wrapped as untrusted data. */
  result: string;
  citations: CitationDto[];
}

const LIMIT = 5;

// A price of 0 means the household quotes on request.
const price = (vnd: number, locale: 'vi' | 'en') =>
  vnd > 0
    ? `${new Intl.NumberFormat('vi-VN').format(vnd)} ₫`
    : locale === 'vi'
      ? 'giá liên hệ'
      : 'price on request';

/**
 * The assistant's database tools, with Guest permissions only (PLAN E15): published products of approved
 * households, and showrooms that take visitors. Nothing here writes, and every call has the 3 s timeout.
 */
@Injectable()
export class CatalogToolsService {
  constructor(private readonly orm: MikroORM) {}

  /** `search_catalog`: up to five published products matching the words of `query`. */
  async searchCatalog(query: string, locale: 'vi' | 'en'): Promise<ToolResult | null> {
    const terms = searchTerms(query);
    if (terms.length === 0) return null;
    return withTimeout(async () => {
      const products = await this.orm.em.fork().find(
        Product,
        {
          $and: [
            { status: 'PUBLISHED', household: { status: 'APPROVED' } },
            ...terms.map((term) => ({ searchText: { $like: `%${term}%` } })),
          ],
        },
        { populate: ['household'], orderBy: { publishedAt: 'desc' }, limit: LIMIT },
      );
      const citations = products.map((p) => ({
        title: p.name,
        url: `/${locale}/san-pham/${p.slug}`,
        type: 'PRODUCT' as const,
      }));
      const lines = products.map(
        (p, i) =>
          `- ${p.name} (${p.household.name}), ${price(p.priceVnd, locale)}: ${citations[i]?.url}`,
      );
      return {
        name: 'search_catalog',
        result: lines.length
          ? lines.join('\n')
          : `No published product matches "${query}". Suggest /${locale}/san-pham or a quote request.`,
        citations,
      };
    });
  }

  /** `get_open_workshops`: showrooms of approved households that are open at `now` (Vietnam time). */
  async openWorkshops(now: Date, locale: 'vi' | 'en'): Promise<ToolResult | null> {
    return withTimeout(async () => {
      const workshops = await this.orm.em
        .fork()
        .find(
          Workshop,
          { acceptsVisitors: true, household: { status: 'APPROVED' } },
          { populate: ['household'], orderBy: { name: 'asc' } },
        );
      const open = workshops.filter(
        (w) => isVisitable(w) && w.openingHours && openState(w.openingHours, now).open,
      );
      const shown = open.slice(0, LIMIT);
      const citations = shown.map((w) => ({
        title: w.household.name,
        url: `/${locale}/nghe-nhan/${w.household.slug}`,
        type: 'HOUSEHOLD' as const,
      }));
      const lines = shown.map((w, i) => {
        const state = openState(w.openingHours ?? [], now);
        const until = state.open ? ` until ${state.closesAt}` : '';
        return `- ${w.name}, ${w.address} (${w.household.name}), open${until}: ${citations[i]?.url}`;
      });
      return {
        name: 'get_open_workshops',
        result: lines.length
          ? `${open.length} showroom(s) open now:\n${lines.join('\n')}`
          : `No showroom with published opening hours is open right now. Suggest /${locale}/ban-do to see visiting hours.`,
        citations,
      };
    });
  }
}
