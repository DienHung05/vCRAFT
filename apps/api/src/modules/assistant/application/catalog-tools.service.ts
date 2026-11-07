import { MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { CitationDto } from '@vcraft/contracts';
import { Household, Product, Workshop } from '@vcraft/database';
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

// Public paths are localized (`@vcraft/i18n` pathnames): /vi/san-pham/x is /en/products/x.
const PATHS = {
  vi: {
    product: '/vi/san-pham',
    household: '/vi/nghe-nhan',
    catalog: '/vi/san-pham',
    map: '/vi/ban-do',
  },
  en: {
    product: '/en/products',
    household: '/en/artisans',
    catalog: '/en/products',
    map: '/en/map',
  },
} as const;

// A price of 0 means the household quotes on request.
const price = (vnd: number, locale: 'vi' | 'en') =>
  vnd > 0
    ? `${new Intl.NumberFormat('vi-VN').format(vnd)} ₫`
    : locale === 'vi'
      ? 'giá liên hệ'
      : 'price on request';

// Public page paths that name one record: product slug, household slug or trace code (see `@vcraft/i18n`).
const RECORD_PAGE =
  /^\/(?:vi|en)\/(san-pham|products|nghe-nhan|artisans|truy-xuat|trace)\/([^/?#\s]+)\/?(?:[?#].*)?$/;

const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim().slice(0, 160);

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
        url: `${PATHS[locale].product}/${p.slug}`,
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
          : `No published product matches "${query}". Suggest ${PATHS[locale].catalog} or a quote request.`,
        citations,
      };
    });
  }

  /**
   * Resolves a product, household or trace page path into one factual line for the model (FR-AST-05):
   * the product's name, category and household, or the household's name and village. Only published
   * products of approved households are named, as on the public pages. Any other path gives null.
   */
  async pageContext(pagePath: string, locale: 'vi' | 'en'): Promise<string | null> {
    const match = RECORD_PAGE.exec(pagePath);
    const kind = match?.[1];
    const key = match?.[2];
    if (!kind || !key) return null;
    return withTimeout(async () => {
      const em = this.orm.em.fork();
      if (kind === 'nghe-nhan' || kind === 'artisans') {
        const household = await em.findOne(Household, { slug: key, status: 'APPROVED' });
        if (!household) return null;
        const village = household.village ? ` in the village ${oneLine(household.village)}` : '';
        return `This page is the household "${oneLine(household.name)}"${village}.`;
      }
      const where =
        kind === 'truy-xuat' || kind === 'trace' ? { traceCode: key.toUpperCase() } : { slug: key };
      const product = await em.findOne(
        Product,
        { ...where, status: 'PUBLISHED', household: { status: 'APPROVED' } },
        { populate: ['household'] },
      );
      if (!product) return null;
      const { household } = product;
      const village = household.village ? `, village ${oneLine(household.village)}` : '';
      return `This page is the product "${oneLine(product.name)}" (category ${product.category}), made by the household "${oneLine(household.name)}"${village}: ${PATHS[locale].household}/${household.slug}.`;
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
        url: `${PATHS[locale].household}/${w.household.slug}`,
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
          : `No showroom with published opening hours is open right now. Suggest ${PATHS[locale].map} to see visiting hours.`,
        citations,
      };
    });
  }
}
