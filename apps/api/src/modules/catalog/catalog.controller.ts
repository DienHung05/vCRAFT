import { Controller, Get, Param, Query } from '@nestjs/common';
import {
  type ListProductsQuery,
  ListProductsQuerySchema,
  SearchQuerySchema,
} from '@vcraft/contracts';
import { Public } from '../../common/auth/auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CatalogService } from './application/catalog.service';

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

  @Get('households')
  listHouseholds() {
    return this.catalog.listHouseholds();
  }

  @Get('search/suggest')
  suggest(@Query(new ZodValidationPipe(SearchQuerySchema)) query: { q: string }) {
    return this.catalog.suggest(query.q);
  }

  @Get('village/stats')
  villageStats() {
    return this.catalog.villageStats();
  }
}
