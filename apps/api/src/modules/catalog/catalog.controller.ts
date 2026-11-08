import { Controller, Get, Header, Param, Query } from '@nestjs/common';
import {
  type ListProductsQuery,
  ListProductsQuerySchema,
  type ListPublicHouseholdsQuery,
  ListPublicHouseholdsQuerySchema,
  SearchQuerySchema,
} from '@vcraft/contracts';
import { Public } from '../../common/auth/auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CatalogService } from './application/catalog.service';

export const SUGGEST_CACHE_CONTROL = 'public, max-age=0, s-maxage=30, stale-while-revalidate=60';

/** Danh mục công khai (FR-CAT): sản phẩm, hộ, gợi ý tìm kiếm, số liệu làng. */
@Controller()
@Public()
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('products')
  listProducts(@Query(new ZodValidationPipe(ListProductsQuerySchema)) query: ListProductsQuery) {
    return this.catalog.listProducts(query);
  }

  @Get('products/:slug')
  getProduct(@Param('slug') slug: string) {
    return this.catalog.getProduct(slug);
  }

  /** A retired product slug → the current one (PLAN E5); the web answers the old URL with a redirect. */
  @Get('redirects/products/:slug')
  productRedirect(@Param('slug') slug: string) {
    return this.catalog.resolveRedirect('PRODUCT', slug);
  }

  @Get('redirects/households/:slug')
  householdRedirect(@Param('slug') slug: string) {
    return this.catalog.resolveRedirect('HOUSEHOLD', slug);
  }

  /** Every approved household, or one numbered page with `?page=N` (GH#202). */
  @Get('households')
  listHouseholds(
    @Query(new ZodValidationPipe(ListPublicHouseholdsQuerySchema)) query: ListPublicHouseholdsQuery,
  ) {
    return this.catalog.listHouseholds(query);
  }

  /**
   * Short edge cache for suggestions only (FR-CAT-04, NFR-PERF-03): a suspended household's item may stay
   * in the dropdown for up to 30 s; the page behind it is not cached and answers 404 at once.
   */
  @Get('search/suggest')
  @Header('Cache-Control', SUGGEST_CACHE_CONTROL)
  suggest(@Query(new ZodValidationPipe(SearchQuerySchema)) query: { q: string }) {
    return this.catalog.suggest(query.q);
  }

  @Get('village/stats')
  villageStats() {
    return this.catalog.villageStats();
  }
}
