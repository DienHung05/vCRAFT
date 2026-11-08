import { type EntityManager, type FilterQuery, MikroORM } from '@mikro-orm/core';
import { Injectable } from '@nestjs/common';
import type {
  ListNewsQuery,
  MaterialPriceSeriesDto,
  NewsDetailDto,
  NewsListDto,
  NewsPageDto,
  PublicImageDto,
  TodayOutagesDto,
} from '@vcraft/contracts';
import { Household, News, Workshop } from '@vcraft/database';
import {
  activeOutages,
  materialPriceSeries,
  type NewsVisibility,
  outageAudience,
  villageToday,
} from '@vcraft/domain';
import type { Actor } from '../../../common/auth/auth.guard';
import { AppError, notFound } from '../../../common/errors/app-error';
import { MediaService } from '../../media/application/media.service';
import { newsDataOf, toNewsDetailDto, toNewsSummaryDto } from '../news.mapper';

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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const slugOrId = (value: string): FilterQuery<News> =>
  UUID.test(value) ? { id: value } : { slug: value };

/** Published, past its scheduled time, and in the given scope. */
const liveNews = (visibility: NewsVisibility): FilterQuery<News>[] => [
  { status: 'PUBLISHED', visibility, publishedAt: { $lte: new Date() } },
];

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

  async list(query: ListNewsQuery): Promise<NewsListDto | NewsPageDto> {
    if (query.page !== undefined && query.cursor !== undefined) {
      throw new AppError('VALIDATION_MALFORMED_REQUEST', 'Cannot use both page and cursor');
    }
    const em = this.orm.em.fork();
    const and: FilterQuery<News>[] = [
      ...liveNews('PUBLIC'),
      { $or: [{ household: null }, { household: { status: 'APPROVED' } }] },
    ];
    if (query.category) and.push({ category: query.category });
    if (query.householdSlug) and.push({ household: { slug: query.householdSlug } });

    // Numbered pages for the public news list (GH#202, ADR-0020); a page past the end gives the last one.
    if (query.page !== undefined) {
      const limit = query.limit;
      const findPage = (page: number) =>
        em.findAndCount(
          News,
          { $and: and },
          {
            populate: ['household'],
            orderBy: { pinned: 'desc', publishedAt: 'desc', id: 'desc' },
            offset: (page - 1) * limit,
            limit,
          },
        );
      let page = query.page;
      let [rows, total] = await findPage(page);
      const totalPages = Math.ceil(total / limit);
      if (rows.length === 0 && total > 0) {
        page = totalPages;
        [rows, total] = await findPage(page);
      }
      const covers = await this.covers(rows.map((news) => news.id));
      return {
        data: rows.map((news) => toNewsSummaryDto(news, covers.get(news.id) ?? null)),
        nextCursor: null,
        page,
        pageSize: limit,
        total,
        totalPages,
      };
    }

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

  /** A public item by slug, or by id for links from notifications. Village-only news is a 404. */
  async getBySlug(slug: string): Promise<NewsDetailDto> {
    const em = this.orm.em.fork();
    const news = await em.findOne(
      News,
      {
        $and: [
          ...liveNews('PUBLIC'),
          slugOrId(slug),
          { $or: [{ household: null }, { household: { status: 'APPROVED' } }] },
        ],
      },
      { populate: ['household'] },
    );
    if (!news) throw notFound();
    return this.detail(em, news);
  }

  /**
   * Six months of material prices for the news page chart (PLAN E11), from published public
   * `MATERIAL_PRICES` items with structured prices.
   */
  async materialPrices(now = new Date()): Promise<MaterialPriceSeriesDto> {
    const rows = await this.orm.em
      .fork()
      .find(
        News,
        { $and: [...liveNews('PUBLIC'), { category: 'MATERIAL_PRICES' }] },
        { orderBy: { publishedAt: 'desc' }, limit: 60 },
      );
    const notices = rows.flatMap((news) => {
      const prices = newsDataOf(news).materialPrices;
      return prices ? [prices] : [];
    });
    return { series: materialPriceSeries(notices, villageToday(now)) };
  }

  /**
   * Planned power cuts that still matter to the caller (PLAN E11, ADR-0023): published `POWER_SCHEDULE`
   * items of either visibility, for the village date from 00:00 until each cut ends. An approved household
   * gets the cuts of its workshops' areas plus village-wide ones, or every cut while no workshop has an area;
   * an administrator gets every cut.
   */
  async todayOutages(actor: Actor, now = new Date()): Promise<TodayOutagesDto> {
    const em = this.orm.em.fork();
    const household = await this.assertVillageMember(em, actor);
    const workshopAreas = household
      ? (await em.find(Workshop, { household })).map((workshop) => workshop.areaCode ?? null)
      : null;
    const rows = await em.find(
      News,
      {
        status: 'PUBLISHED',
        publishedAt: { $lte: now },
        category: 'POWER_SCHEDULE',
      },
      { orderBy: { publishedAt: 'desc' }, limit: 30 },
    );
    const outages = rows.flatMap((news) => {
      const schedule = newsDataOf(news).powerSchedule;
      return schedule
        ? activeOutages([schedule], now, workshopAreas).map((outage) => ({
            ...outage,
            newsSlug: news.slug,
          }))
        : [];
    });
    outages.sort((a, b) => a.from.localeCompare(b.from));
    return {
      date: villageToday(now),
      outages: outages.map((outage) => ({
        from: outage.from,
        to: outage.to,
        area: outage.area,
        areaCode: outageAudience(outage),
        newsSlug: outage.newsSlug,
      })),
      needsWorkshopArea: workshopAreas ? workshopAreas.every((area) => area === null) : false,
    };
  }

  /** Village-only news, for approved households and administrators (FR-NEWS-02). */
  async listVillage(actor: Actor, limit: number): Promise<NewsListDto> {
    const em = this.orm.em.fork();
    await this.assertVillageMember(em, actor);
    const rows = await em.find(
      News,
      { $and: liveNews('VILLAGE') },
      {
        populate: ['household'],
        orderBy: { pinned: 'desc', publishedAt: 'desc', id: 'desc' },
        limit,
      },
    );
    const covers = await this.covers(rows.map((news) => news.id));
    return {
      data: rows.map((news) => toNewsSummaryDto(news, covers.get(news.id) ?? null)),
      nextCursor: null,
    };
  }

  async getVillage(actor: Actor, slug: string): Promise<NewsDetailDto> {
    const em = this.orm.em.fork();
    await this.assertVillageMember(em, actor);
    const news = await em.findOne(
      News,
      { $and: [...liveNews('VILLAGE'), slugOrId(slug)] },
      { populate: ['household'] },
    );
    if (!news) throw notFound();
    return this.detail(em, news);
  }

  /** The caller's approved household, or null for an administrator; anyone else gets a 404. */
  private async assertVillageMember(em: EntityManager, actor: Actor): Promise<Household | null> {
    if (actor.role === 'ADMIN') return null;
    const household = await em.findOne(Household, {
      representative: actor.id,
      status: 'APPROVED',
    });
    if (!household) throw notFound();
    return household;
  }

  private async detail(em: EntityManager, news: News): Promise<NewsDetailDto> {
    const related = await em.find(
      News,
      {
        $and: [
          ...liveNews('PUBLIC'),
          { category: news.category, id: { $ne: news.id } },
          { $or: [{ household: null }, { household: { status: 'APPROVED' } }] },
        ],
      },
      { populate: ['household'], orderBy: { publishedAt: 'desc', id: 'desc' }, limit: 3 },
    );
    const covers = await this.covers([news.id, ...related.map((item) => item.id)]);
    return toNewsDetailDto(
      news,
      covers.get(news.id) ?? null,
      related.map((item) => toNewsSummaryDto(item, covers.get(item.id) ?? null)),
    );
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
