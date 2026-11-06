import { type FilterQuery, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  HouseholdListDto,
  ListProductsQuery,
  ProductCardDto,
  ProductDetailDto,
  ProductListDto,
  ProductPageDto,
  ProductSort,
  SearchSuggestionsDto,
  SlugRedirectDto,
  VillageStatsDto,
} from '@vcraft/contracts';
import {
  Artisan,
  Household,
  News,
  Product,
  ProductMaker,
  SlugRedirect,
  type SlugRedirectKind,
  Workshop,
} from '@vcraft/database';
import { isVisitable } from '@vcraft/domain';
import { searchTerms } from '@vcraft/utils';
import { AppError, notFound } from '../../../common/errors/app-error';
import {
  type CoverImage,
  productCover,
  productMediaIds,
  toProductDto,
  variantsOfUrl,
} from '../../households/households.mapper';
import { MediaService, type PublicMedia } from '../../media/application/media.service';
import { loadJournal } from '../../production-logs/application/journal.queries';

interface ProductCursor {
  /** Giá trị khóa sắp xếp: ISO của `publishedAt` hoặc giá. */
  v: string | number;
  id: string;
}

const SUGGESTION_LIMIT = 5;

function encodeCursor(product: Product, sort: ProductSort): string {
  const cursor: ProductCursor = {
    v: sort === 'newest' ? (product.publishedAt as Date).toISOString() : product.priceVnd,
    id: product.id,
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string, sort: ProductSort): ProductCursor {
  try {
    const value = JSON.parse(
      Buffer.from(raw, 'base64url').toString('utf8'),
    ) as Partial<ProductCursor>;
    const validKey =
      sort === 'newest'
        ? typeof value.v === 'string' && !Number.isNaN(Date.parse(value.v))
        : typeof value.v === 'number';
    if (validKey && typeof value.id === 'string') return { v: value.v as string, id: value.id };
  } catch {
    // rơi xuống lỗi bên dưới
  }
  throw new AppError('VALIDATION_MALFORMED_REQUEST', 'cursor is not valid');
}

/** Điều kiện "sau con trỏ" khớp đúng thứ tự sắp xếp, để không lặp hay sót khi tải thêm. */
function afterCursor(cursor: ProductCursor, sort: ProductSort): FilterQuery<Product> {
  if (sort === 'newest') {
    const at = new Date(cursor.v);
    return {
      $or: [{ publishedAt: { $lt: at } }, { publishedAt: at, id: { $lt: cursor.id } }],
    };
  }
  const price = cursor.v as number;
  const beyond = sort === 'price_asc' ? { $gt: price } : { $lt: price };
  return { $or: [{ priceVnd: beyond }, { priceVnd: price, id: { $gt: cursor.id } }] };
}

const ORDER_BY = {
  newest: { publishedAt: 'desc', id: 'desc' },
  price_asc: { priceVnd: 'asc', id: 'asc' },
  price_desc: { priceVnd: 'desc', id: 'asc' },
} as const;

function toCardDto(
  p: Product,
  media: ReadonlyMap<string, PublicMedia>,
  linkedCovers: readonly CoverImage[] = [],
): ProductCardDto {
  const cover = productCover(p, media, linkedCovers);
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    traceCode: p.traceCode,
    kind: p.kind,
    category: p.category,
    priceVnd: p.priceVnd,
    stock: p.stock,
    coverUrl: cover.url,
    coverVariants: cover.variants,
    coverAlt: cover.alt,
    coverAltEn: cover.altEn,
    publishedAt: p.publishedAt?.toISOString() ?? null,
    household: { name: p.household.name, slug: p.household.slug },
  };
}

/**
 * Đọc công khai cho danh mục (FR-CAT): chỉ sản phẩm `PUBLISHED` của hộ `APPROVED`. Tìm kiếm khớp
 * cột `searchText` đã bỏ dấu, nên chạy giống nhau trên PostgreSQL và MySQL.
 */
@Injectable()
export class CatalogService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
  ) {}

  async listProducts(query: ListProductsQuery): Promise<ProductListDto | ProductPageDto> {
    // Reject page + cursor together
    if (query.page !== undefined && query.cursor !== undefined) {
      throw new AppError('VALIDATION_MALFORMED_REQUEST', 'Cannot use both page and cursor');
    }

    const em = this.orm.em.fork();
    const and: FilterQuery<Product>[] = [
      {
        status: 'PUBLISHED',
        household: {
          status: 'APPROVED',
          ...(query.household !== undefined && { slug: query.household }),
        },
      },
      ...searchTerms(query.q ?? '').map((term) => ({ searchText: { $like: `%${term}%` } })),
    ];
    if (query.category) and.push({ category: query.category });
    if (query.minPrice !== undefined) and.push({ priceVnd: { $gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ priceVnd: { $lte: query.maxPrice } });
    if (query.oneOfAKind !== undefined) {
      and.push({ kind: query.oneOfAKind ? 'OBJECT' : 'BATCH' });
    }
    if (query.inStock !== undefined) {
      and.push({ stock: query.inStock ? { $gt: 0 } : 0 });
    }

    // Page-based mode (catalog exception, see ADR-0020)
    if (query.page !== undefined) {
      const limit = query.limit;
      const findPage = (pageNumber: number) =>
        em.findAndCount(
          Product,
          { $and: and },
          {
            populate: ['household'],
            orderBy: ORDER_BY[query.sort],
            offset: (pageNumber - 1) * limit,
            limit,
          },
        );
      let pg = query.page;
      let [rows, total] = await findPage(pg);
      const totalPages = Math.ceil(total / limit);
      // A page past the end answers with the last page instead of an empty list.
      if (rows.length === 0 && total > 0) {
        pg = totalPages;
        [rows, total] = await findPage(pg);
      }
      const [media, covers] = await Promise.all([
        this.media.publicMedia(productMediaIds(rows)),
        this.media.productCoverImages(rows),
      ]);
      return {
        data: rows.map((product) => toCardDto(product, media, covers.get(product.id))),
        nextCursor: null,
        page: pg,
        pageSize: limit,
        total,
        totalPages,
      };
    }

    // Cursor-based mode (default, backward compatible)
    if (query.cursor) and.push(afterCursor(decodeCursor(query.cursor, query.sort), query.sort));

    const rows = await em.find(
      Product,
      { $and: and },
      {
        populate: ['household'],
        orderBy: ORDER_BY[query.sort],
        limit: query.limit + 1,
      },
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const [media, covers] = await Promise.all([
      this.media.publicMedia(productMediaIds(page)),
      this.media.productCoverImages(page),
    ]);
    return {
      data: page.map((product) => toCardDto(product, media, covers.get(product.id))),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last, query.sort) : null,
    };
  }

  /** Sản phẩm rút, nháp hoặc của hộ không còn duyệt đều là 404 trên trang chi tiết. */
  /**
   * The current slug behind a retired one, only when the target is publicly visible (a published product
   * of an approved household, or an approved household); otherwise 404 like the page itself.
   */
  async resolveRedirect(kind: SlugRedirectKind, slug: string): Promise<SlugRedirectDto> {
    const em = this.orm.em.fork();
    const row = await em.findOne(SlugRedirect, { kind, oldSlug: slug });
    if (!row) throw notFound();
    const target =
      kind === 'PRODUCT'
        ? await em.findOne(Product, {
            id: row.targetId,
            status: 'PUBLISHED',
            household: { status: 'APPROVED' },
          })
        : await em.findOne(Household, { id: row.targetId, status: 'APPROVED' });
    if (!target) throw notFound();
    return { slug: target.slug };
  }

  async getProduct(slug: string): Promise<ProductDetailDto> {
    const em = this.orm.em.fork();
    const product = await em.findOne(
      Product,
      { slug, status: 'PUBLISHED', household: { status: 'APPROVED' } },
      { populate: ['household'] },
    );
    if (!product) throw notFound();
    const makers = await em.find(
      ProductMaker,
      { product },
      { populate: ['artisan'], orderBy: { position: 'asc' } },
    );
    const covers = await this.media.productCoverImages([product]);
    return {
      product: toProductDto(
        product,
        makers,
        await this.media.publicMedia(productMediaIds([product])),
        covers.get(product.id),
      ),
      coverCredit: await this.media.productCoverCredit(product),
      household: { name: product.household.name, slug: product.household.slug },
      journal: await loadJournal(em, product, this.media),
    };
  }

  async listHouseholds(): Promise<HouseholdListDto> {
    const em = this.orm.em.fork();
    const households = await em.find(
      Household,
      { status: 'APPROVED' },
      { orderBy: { name: 'asc' } },
    );
    if (households.length === 0) return { data: [] };
    const ids = households.map((h) => h.id);
    const [artisans, workshops, products, banners] = await Promise.all([
      em.find(Artisan, { household: { $in: ids } }, { orderBy: { createdAt: 'asc' } }),
      em.find(Workshop, { household: { $in: ids } }, { orderBy: { createdAt: 'asc' } }),
      em.find(Product, { household: { $in: ids }, status: 'PUBLISHED' }, { fields: ['household'] }),
      this.media.linkedImages('HOUSEHOLD', ids, ['BANNER']),
    ]);
    return {
      data: households.map((h) => {
        const hours = workshops.find((w) => w.household.id === h.id && isVisitable(w));
        const banner = (banners.get(h.id) ?? []).find((item) => item.image.url === h.coverUrl);
        return {
          id: h.id,
          name: h.name,
          slug: h.slug,
          village: h.village ?? null,
          craft: h.craft ?? null,
          coverUrl: h.coverUrl ?? null,
          coverVariants: variantsOfUrl(
            h.coverUrl ?? null,
            (banners.get(h.id) ?? []).map((item) => item.image),
          ),
          coverAlt: banner?.image.alt || null,
          coverAltEn: banner?.image.altEn ?? null,
          representative: artisans.find((a) => a.household.id === h.id)?.name ?? null,
          productCount: products.filter((p) => p.household.id === h.id).length,
          openingHours: hours?.openingHours ?? null,
        };
      }),
    };
  }

  async suggest(q: string): Promise<SearchSuggestionsDto> {
    const terms = searchTerms(q);
    if (terms.length === 0) return { products: [], households: [], news: [] };
    const em = this.orm.em.fork();
    const matching = terms.map((term) => ({ searchText: { $like: `%${term}%` } }));
    const [products, households, news] = await Promise.all([
      em.find(
        Product,
        { $and: [{ status: 'PUBLISHED', household: { status: 'APPROVED' } }, ...matching] },
        { populate: ['household'], orderBy: { name: 'asc' }, limit: SUGGESTION_LIMIT },
      ),
      em.find(
        Household,
        { $and: [{ status: 'APPROVED' }, ...matching] },
        { orderBy: { name: 'asc' }, limit: SUGGESTION_LIMIT },
      ),
      em.find(
        News,
        {
          $and: [
            { status: 'PUBLISHED' },
            { $or: [{ household: null }, { household: { status: 'APPROVED' } }] },
            ...matching,
          ],
        },
        { orderBy: { publishedAt: 'desc' }, limit: SUGGESTION_LIMIT },
      ),
    ]);
    return {
      products: products.map((p) => ({
        name: p.name,
        slug: p.slug,
        household: p.household.name,
      })),
      households: households.map((h) => ({ name: h.name, slug: h.slug })),
      news: news.map((n) => ({ title: n.title, slug: n.slug })),
    };
  }

  async villageStats(): Promise<VillageStatsDto> {
    const em = this.orm.em.fork();
    const [households, products, artisans] = await Promise.all([
      em.count(Household, { status: 'APPROVED' }),
      em.count(Product, { status: 'PUBLISHED', household: { status: 'APPROVED' } }),
      em.count(Artisan, { household: { status: 'APPROVED' } }),
    ]);
    return { households, products, artisans };
  }
}
