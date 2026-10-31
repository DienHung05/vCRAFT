import { type FilterQuery, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type { ListNewsQuery, NewsDetailDto, NewsListDto, PublicImageDto } from '@vcraft/contracts';
import { News } from '@vcraft/database';
import { AppError, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { toNewsDetailDto, toNewsSummaryDto } from '../news.mapper';

/** Khóa con trỏ: vị trí của dòng cuối trang theo thứ tự (ghim, ngày xuất bản, id) giảm dần. */
interface NewsCursor {
  p: boolean;
  t: string;
  id: string;
}

function encodeCursor(news: News): string {
  const cursor: NewsCursor = {
    p: news.pinned,
    t: (news.publishedAt as Date).toISOString(),
    id: news.id,
  };
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

function decodeCursor(raw: string): NewsCursor {
  try {
    const value = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as Partial<NewsCursor>;
    if (
      typeof value.p === 'boolean' &&
      typeof value.t === 'string' &&
      typeof value.id === 'string' &&
      !Number.isNaN(Date.parse(value.t))
    ) {
      return { p: value.p, t: value.t, id: value.id };
    }
  } catch {
    // rơi xuống lỗi bên dưới
  }
  throw new AppError('VALIDATION_MALFORMED_REQUEST', 'cursor is not valid');
}

/**
 * Tin tức công khai (vCRAFT-83g): chỉ tin `PUBLISHED`; tin của hộ chỉ hiện khi hộ còn `APPROVED`
 * (hộ tạm ngừng ẩn mọi nội dung công khai, giống hồ sơ và sản phẩm).
 */
@Injectable()
export class NewsService {
  constructor(
    private readonly orm: MikroORM,
    private readonly media: MediaService,
  ) {}

  async list(query: ListNewsQuery): Promise<NewsListDto> {
    const em = this.orm.em.fork();
    const and: FilterQuery<News>[] = [
      { status: 'PUBLISHED' },
      { $or: [{ household: null }, { household: { status: 'APPROVED' } }] },
    ];
    if (query.category) and.push({ category: query.category });
    if (query.householdSlug) and.push({ household: { slug: query.householdSlug } });
    if (query.cursor) {
      const cursor = decodeCursor(query.cursor);
      const at = new Date(cursor.t);
      const after: FilterQuery<News>[] = [
        { pinned: cursor.p, publishedAt: { $lt: at } },
        { pinned: cursor.p, publishedAt: at, id: { $lt: cursor.id } },
      ];
      if (cursor.p) after.push({ pinned: false });
      and.push({ $or: after });
    }

    const rows = await em.find(
      News,
      { $and: and },
      {
        populate: ['household'],
        orderBy: { pinned: 'desc', publishedAt: 'desc', id: 'desc' },
        limit: query.limit + 1,
      },
    );
    const page = rows.slice(0, query.limit);
    const last = page.at(-1);
    const covers = await this.covers(page.map((news) => news.id));
    return {
      data: page.map((news) => toNewsSummaryDto(news, covers.get(news.id) ?? null)),
      nextCursor: rows.length > query.limit && last ? encodeCursor(last) : null,
    };
  }

  async getBySlug(slug: string): Promise<NewsDetailDto> {
    const em = this.orm.em.fork();
    const news = await em.findOne(
      News,
      {
        slug,
        status: 'PUBLISHED',
        $or: [{ household: null }, { household: { status: 'APPROVED' } }],
      },
      { populate: ['household'] },
    );
    if (!news) throw notFound();
    return toNewsDetailDto(news, (await this.covers([news.id])).get(news.id) ?? null);
  }

  private async covers(newsIds: readonly string[]): Promise<Map<string, PublicImageDto>> {
    const linked = await this.media.linkedImages('NEWS', newsIds, ['COVER']);
    const covers = new Map<string, PublicImageDto>();
    for (const [id, [cover]] of linked) {
      if (cover) covers.set(id, cover.image);
    }
    return covers;
  }
}
