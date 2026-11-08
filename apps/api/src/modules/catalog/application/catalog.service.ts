import {
  type EntityManager,
  type FilterQuery,
  MikroORM,
  type QueryOrderMap,
  raw,
} from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import {
  DEFAULT_PAGE_LIMIT,
  type HouseholdListDto,
  type HouseholdPageDto,
  type ListProductsQuery,
  type ListPublicHouseholdsQuery,
  type ProductCardDto,
  type ProductDetailDto,
  type ProductListDto,
  type ProductPageDto,
  type ProductSort,
  type SearchSuggestionsDto,
  type SlugRedirectDto,
  type VillageStatsDto,
} from '@vcraft/contracts';
import {
  Artisan,
  Household,
  News,
  Product,
  ProductMaker,
  SlugRedirect,
  type SlugRedirectKind,
  TraceScan,
  Workshop,
} from '@vcraft/database';
import {
  isVisitable,
  PRODUCT_CATEGORIES,
  PRODUCT_CATEGORY_LABELS,
  type ProductCategory,
} from '@vcraft/domain';
import { normalizeSearchText, searchTerms } from '@vcraft/utils';
import { AppError, notFound } from '../../../common/errors/app-error';
import { ratingSummaries } from '../../households/household-rating-stats';
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
  /** Sort key value: ISO of `publishedAt` (newest), the price, or the 30-day scan count (popular). */
  v: string | number;
  id: string;
  /** Popular only: `publishedAt` of the last row (the tie-break) and the window start the counts used. */
  at?: string;
  since?: string;
}

const SUGGESTION_LIMIT = 5;
/** Window of the `popular` sort: trace QR scans in the last 30 days. */
const POPULAR_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

const isDate = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));

/**
 * Number of trace scans of the product since `since`, as a correlated subquery on `trace_scan` (index
 * `product_id, created_at`), so one statement ranks the whole page of products with no query per row.
 */
const scanCount = (since: Date) =>
  raw(
    (alias) =>
      `(select count(*) from trace_scan ts where ts.product_id = ${alias}.id and ts.created_at >= ?)`,
    [since],
  );

/** Households with at least one workshop that welcomes visitors (the SQL twin of `isVisitable`). */
const visitableWorkshops = () =>
  raw(
    (alias) =>
      `(select count(*) from workshop w where w.household_id = ${alias}.household_id and w.accepts_visitors = true and w.purpose <> 'PRODUCTION')`,
  );

function encodeCursor(
  product: Product,
  sort: ProductSort,
  popular?: { count: number; since: Date },
): string {
  const publishedAt = (product.publishedAt as Date).toISOString();
  let cursor: ProductCursor;
  if (sort === 'popular') {
    if (!popular) throw new Error('popular cursor needs its window');
    cursor = {
      v: popular.count,
      id: product.id,
      at: publishedAt,
      since: popular.since.toISOString(),
    };
  } else {
    cursor = { v: sort === 'newest' ? publishedAt : product.priceVnd, id: product.id };
  }
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(encoded: string, sort: ProductSort): ProductCursor {
  try {
    const value = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf8'),
    ) as Partial<ProductCursor>;
    const validKey =
      sort === 'newest'
        ? isDate(value.v)
        : sort === 'popular'
          ? typeof value.v === 'number' && isDate(value.at) && isDate(value.since)
          : typeof value.v === 'number';
    if (validKey && typeof value.id === 'string') {
      return { v: value.v as string, id: value.id, at: value.at, since: value.since };
    }
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
  if (sort === 'popular') {
    const scans = scanCount(new Date(cursor.since as string));
    const count = cursor.v as number;
    const at = new Date(cursor.at as string);
    return {
      $or: [
        { [scans as unknown as string]: { $lt: count } },
        { [scans as unknown as string]: count, publishedAt: { $lt: at } },
        { [scans as unknown as string]: count, publishedAt: at, id: { $lt: cursor.id } },
      ],
    };
  }
  const price = cursor.v as number;
  const beyond = sort === 'price_asc' ? { $gt: price } : { $lt: price };
  return { $or: [{ priceVnd: beyond }, { priceVnd: price, id: { $gt: cursor.id } }] };
}

/** Sort keys of one request; `popular` ranks by scans since `since`, newest first among equals. */
function orderByFor(
  sort: ProductSort,
  since: Date,
): QueryOrderMap<Product> | QueryOrderMap<Product>[] {
  switch (sort) {
    case 'newest':
      return { publishedAt: 'desc', id: 'desc' };
    case 'price_asc':
      return { priceVnd: 'asc', id: 'asc' };
    case 'price_desc':
      return { priceVnd: 'desc', id: 'asc' };
    case 'popular':
      return [
        { [scanCount(since) as unknown as string]: 'desc' },
        { publishedAt: 'desc' },
        { id: 'desc' },
      ];
  }
}

/** Categories whose name, in either language, contains the whole search phrase (`do tho` finds `Đồ thờ`). */
function categoriesMatching(terms: readonly string[]): ProductCategory[] {
  const phrase = terms.join(' ');
  if (!phrase) return [];
  return PRODUCT_CATEGORIES.filter((category) => {
    const { vi, en } = PRODUCT_CATEGORY_LABELS[category];
    return [vi, en].some((label) => normalizeSearchText(label).includes(phrase));
  });
}

/**
 * Filter for a search phrase on products: every term appears in the accent-free `searchText`, or the
 * phrase names a category (so `do tho` lists the altar pieces too).
 */
function productSearch(terms: readonly string[]): FilterQuery<Product>[] {
  if (terms.length === 0) return [];
  const matching = terms.map((term) => ({ searchText: { $like: `%${term}%` } }));
  const categories = categoriesMatching(terms);
  return categories.length > 0
    ? [{ $or: [{ $and: matching }, { category: { $in: categories } }] }]
    : matching;
}

export function toCardDto(
  p: Product,
  media: ReadonlyMap<string, PublicMedia>,
  linkedCovers: readonly CoverImage[] = [],
): ProductCardDto {
  const cover = productCover(p, media, linkedCovers);
  return {
    id: p.id,
    name: p.name,
    nameEn: p.nameEn ?? null,
    slug: p.slug,
    traceCode: p.traceCode,
    kind: p.kind,
    category: p.category,
    priceVnd: p.priceVnd,
    stock: p.stock,
    status: p.status === 'SOLD' ? 'SOLD' : 'PUBLISHED',
    tags: p.tags ?? [],
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
        // A sold one-of-a-kind piece stays in the catalog with a "sold" badge (FR-PRD-01).
        status: { $in: ['PUBLISHED', 'SOLD'] },
        household: {
          status: 'APPROVED',
          ...(query.household !== undefined && { slug: query.household }),
        },
      },
      ...productSearch(searchTerms(query.q ?? '')),
    ];
    if (query.ids) and.push({ id: { $in: query.ids } });
    if (query.category) and.push({ category: query.category });
    if (query.minPrice !== undefined) and.push({ priceVnd: { $gte: query.minPrice } });
    if (query.maxPrice !== undefined) and.push({ priceVnd: { $lte: query.maxPrice } });
    if (query.oneOfAKind !== undefined) {
      and.push({ kind: query.oneOfAKind ? 'OBJECT' : 'BATCH' });
    }
    if (query.inStock !== undefined) {
      // A sold piece is never in stock, whatever its stock column says.
      and.push(
        query.inStock
          ? { status: 'PUBLISHED', stock: { $gt: 0 } }
          : { $or: [{ status: 'SOLD' }, { stock: 0 }] },
      );
    }
    if (query.openWorkshop !== undefined) {
      const visitable = visitableWorkshops() as unknown as string;
      and.push({ [visitable]: query.openWorkshop ? { $gt: 0 } : 0 });
    }
    // One window start per request, so the ranking and the cursors of a scroll agree.
    const cursor = query.cursor ? decodeCursor(query.cursor, query.sort) : undefined;
    const since = cursor?.since ? new Date(cursor.since) : new Date(Date.now() - POPULAR_WINDOW_MS);
    const orderBy = orderByFor(query.sort, since);

    // Page-based mode (catalog exception, see ADR-0020)
    if (query.page !== undefined) {
      const limit = query.limit;
      const findPage = (pageNumber: number) =>
        em.findAndCount(
          Product,
          { $and: and },
          {
            populate: ['household'],
            orderBy,
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
    if (cursor) and.push(afterCursor(cursor, query.sort));

    const rows = await em.find(
      Product,
      { $and: and },
      {
        populate: ['household'],
        orderBy,
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
      nextCursor:
        rows.length > query.limit && last
          ? encodeCursor(
              last,
              query.sort,
              query.sort === 'popular'
                ? {
                    count: await em.count(TraceScan, { product: last, createdAt: { $gte: since } }),
                    since,
                  }
                : undefined,
            )
          : null,
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
            status: { $in: ['PUBLISHED', 'SOLD'] },
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
      { slug, status: { $in: ['PUBLISHED', 'SOLD'] }, household: { status: 'APPROVED' } },
      { populate: ['household'] },
    );
    if (!product) throw notFound();
    // Independent reads run together: sequential awaits cost one database round trip each (GH#255).
    const [makers, covers, media, journal] = await Promise.all([
      em.find(ProductMaker, { product }, { populate: ['artisan'], orderBy: { position: 'asc' } }),
      this.media.productCoverImages([product]),
      this.media.publicMedia(productMediaIds([product])),
      loadJournal(em, product, this.media),
    ]);
    return {
      product: toProductDto(product, makers, media, covers.get(product.id)),
      // The cover credit is the first linked cover image's: the same row set `productCoverImages` just read.
      coverCredit: covers.get(product.id)?.[0]?.credit ?? null,
      household: { name: product.household.name, slug: product.household.slug },
      journal,
    };
  }

  /**
   * Approved households by name. Without `page` every one comes back (home page, map, catalog filter); with
   * `page` one numbered page plus totals, and a page past the end answers with the last page (GH#202).
   */
  async listHouseholds(
    query: Partial<ListPublicHouseholdsQuery> = {},
  ): Promise<HouseholdListDto | HouseholdPageDto> {
    const em = this.orm.em.fork();
    const where = { status: 'APPROVED' } as const;
    const orderBy = { name: 'asc', id: 'asc' } as const;
    if (query.page === undefined) {
      return {
        data: await this.householdSummaries(em, await em.find(Household, where, { orderBy })),
      };
    }
    const limit = query.limit ?? DEFAULT_PAGE_LIMIT;
    const findPage = (page: number) =>
      em.findAndCount(Household, where, { orderBy, offset: (page - 1) * limit, limit });
    let page = query.page;
    let [households, total] = await findPage(page);
    const totalPages = Math.ceil(total / limit);
    if (households.length === 0 && total > 0) {
      page = totalPages;
      [households, total] = await findPage(page);
    }
    return {
      data: await this.householdSummaries(em, households),
      page,
      pageSize: limit,
      total,
      totalPages,
    };
  }

  /** Cards for the given households: representative, product count, cover and visiting hours. */
  private async householdSummaries(
    em: EntityManager,
    households: Household[],
  ): Promise<HouseholdListDto['data']> {
    if (households.length === 0) return [];
    const ids = households.map((h) => h.id);
    const [artisans, workshops, products, banners, ratings] = await Promise.all([
      em.find(Artisan, { household: { $in: ids } }, { orderBy: { createdAt: 'asc' } }),
      em.find(Workshop, { household: { $in: ids } }, { orderBy: { createdAt: 'asc' } }),
      em.find(Product, { household: { $in: ids }, status: 'PUBLISHED' }, { fields: ['household'] }),
      this.media.linkedImages('HOUSEHOLD', ids, ['BANNER']),
      ratingSummaries(em, ids),
    ]);
    return households.map((h) => {
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
        ratingAverage: ratings.get(h.id)?.average ?? null,
        ratingCount: ratings.get(h.id)?.count ?? 0,
        openingHours: hours?.openingHours ?? null,
      };
    });
  }

  async suggest(q: string): Promise<SearchSuggestionsDto> {
    const terms = searchTerms(q);
    if (terms.length === 0) return { products: [], households: [], categories: [], news: [] };
    const em = this.orm.em.fork();
    const matching = terms.map((term) => ({ searchText: { $like: `%${term}%` } }));
    // Only the columns the dropdown shows: descriptions, images and article bodies stay in the database.
    const [products, households, news] = await Promise.all([
      em.find(
        Product,
        {
          $and: [
            { status: { $in: ['PUBLISHED', 'SOLD'] }, household: { status: 'APPROVED' } },
            ...productSearch(terms),
          ],
        },
        {
          fields: ['name', 'nameEn', 'slug', 'household.name'],
          orderBy: { name: 'asc' },
          limit: SUGGESTION_LIMIT,
        },
      ),
      em.find(
        Household,
        { $and: [{ status: 'APPROVED' }, ...matching] },
        { fields: ['name', 'slug'], orderBy: { name: 'asc' }, limit: SUGGESTION_LIMIT },
      ),
      em.find(
        News,
        {
          // Only what a guest can open (GH#231): public news whose publish time has passed, like the news list.
          $and: [
            { status: 'PUBLISHED', visibility: 'PUBLIC', publishedAt: { $lte: new Date() } },
            { $or: [{ household: null }, { household: { status: 'APPROVED' } }] },
            ...matching,
          ],
        },
        { fields: ['title', 'slug'], orderBy: { publishedAt: 'desc' }, limit: SUGGESTION_LIMIT },
      ),
    ]);
    return {
      products: products.map((p) => ({
        name: p.name,
        nameEn: p.nameEn ?? null,
        slug: p.slug,
        household: p.household.name,
      })),
      households: households.map((h) => ({ name: h.name, slug: h.slug })),
      categories: categoriesMatching(terms)
        .slice(0, SUGGESTION_LIMIT)
        .map((category) => ({ category })),
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
