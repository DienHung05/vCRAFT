import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  Param,
  Post,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import {
  type ListAdminNewsQuery,
  ListAdminNewsQuerySchema,
  ListNewsQuerySchema,
  type SaveNewsRequest,
  SaveNewsRequestSchema,
} from '@vcraft/contracts';
import { type Actor, CurrentActor, Public, Roles } from '../../common/auth/auth.guard';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { IfMatchVersion } from '../../common/http/if-match';
import { withPublicCache } from '../../common/http/public-cache';
import { UuidPipe } from '../../common/pipes/uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NewsService } from './application/news.service';
import { NewsAdminService } from './application/news-admin.service';

/** Declared before the public controller, whose `:slug` route would otherwise catch `village`. */
@Controller('news/village')
@Roles('HOUSEHOLD', 'ADMIN')
export class VillageNewsController {
  constructor(private readonly news: NewsService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentActor() actor: Actor) {
    return this.news.listVillage(actor, 24);
  }

  @Get(':slug')
  @Header('Cache-Control', 'private, no-store')
  get(@CurrentActor() actor: Actor, @Param('slug') slug: string) {
    return this.news.getVillage(actor, slug);
  }
}

/** Tin tức công khai: không cần đăng nhập, cache ngắn hạn + ETag. */
@Controller('news')
@Public()
export class NewsController {
  constructor(private readonly news: NewsService) {}

  /** Ghim trước, rồi mới nhất trước; `?householdSlug=` lọc tin của một hộ. */
  @Get()
  async list(
    @Query(new ZodValidationPipe(ListNewsQuerySchema))
    query: ReturnType<typeof ListNewsQuerySchema.parse>,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    return withPublicCache(request, reply, await this.news.list(query));
  }

  @Get(':slug')
  async get(
    @Param('slug') slug: string,
    @Req() request: HttpRequest,
    @Res({ passthrough: true }) reply: HttpReply,
  ) {
    return withPublicCache(request, reply, await this.news.getBySlug(slug));
  }
}

/** News management for administrators (FR-NEWS-01, 02). Every write is audited. */
@Controller('admin/news')
@Roles('ADMIN')
export class AdminNewsController {
  constructor(private readonly news: NewsAdminService) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@Query(new ZodValidationPipe(ListAdminNewsQuerySchema)) query: ListAdminNewsQuery) {
    return this.news.list(query);
  }

  @Get(':id')
  @Header('Cache-Control', 'private, no-store')
  get(@Param('id', new UuidPipe()) id: string) {
    return this.news.get(id);
  }

  @Post()
  create(
    @CurrentActor() actor: Actor,
    @Body(new ZodValidationPipe(SaveNewsRequestSchema)) body: SaveNewsRequest,
  ) {
    return this.news.create(actor, body);
  }

  @Put(':id')
  update(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
    @Body(new ZodValidationPipe(SaveNewsRequestSchema)) body: SaveNewsRequest,
  ) {
    return this.news.update(actor, id, version, body);
  }

  @Delete(':id')
  @HttpCode(204)
  remove(
    @CurrentActor() actor: Actor,
    @Param('id', new UuidPipe()) id: string,
    @IfMatchVersion() version: number,
  ) {
    return this.news.remove(actor, id, version);
  }
}
