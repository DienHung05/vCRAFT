import { Controller, Get, Param, Query, Req, Res } from '@nestjs/common';
import { ListNewsQuerySchema } from '@vcraft/contracts';
import { Public } from '../../common/auth/auth.guard';
import type { HttpReply, HttpRequest } from '../../common/http/http-types';
import { withPublicCache } from '../../common/http/public-cache';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { NewsService } from './application/news.service';

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
