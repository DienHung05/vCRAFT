import { createHash, randomUUID } from 'node:crypto';
import type { MikroORM } from '@mikro-orm/core';
import { AppUser, MediaAsset, MediaLink, News, queueKnowledgeChange } from '@vcraft/database';
import type { NewsOrigin } from '@vcraft/domain';
import type { ObjectStorage } from '@vcraft/storage';
import { slugify } from '@vcraft/utils';
import { processMediaAsset } from '../media/process-media';
import type { NewsImportConfig } from './config';
import { duplicateOf } from './dedup';
import { type FeedItem, parseFeed } from './feed';
import {
  buildFillerPrompt,
  FILLER_TOPICS,
  type FillerTopic,
  fillerBody,
  needsFiller,
  parseFillerArticle,
} from './filler';
import type { NewsLlm } from './llm';
import { type CommonsCandidate, choosePhoto, type PhotoChoice, searchCommons } from './photos';
import { relevance } from './relevance';
import { fetchCapped } from './safe-fetch';
import { storyText } from './text';

export interface NewsJobLogger {
  log(message: string): void;
  warn(message: string): void;
}

export interface NewsImportDeps {
  orm: MikroORM;
  storage: ObjectStorage;
  llm: NewsLlm | null;
  config: NewsImportConfig;
  logger: NewsJobLogger;
  fetchImpl?: typeof fetch;
  now?: Date;
  /** Commons search; replaceable in tests so nothing touches the network. */
  searchPhotos?: (query: string) => Promise<CommonsCandidate[]>;
}

export interface NewsImportReport {
  fetched: number;
  imported: number;
  generated: number;
  skipped: Record<string, number>;
  feedErrors: number;
}

const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_FEED_BYTES = 2 * 1024 * 1024;
const DAY_MS = 24 * 60 * 60 * 1000;

const bump = (counts: Record<string, number>, reason: string) => {
  counts[reason] = (counts[reason] ?? 0) + 1;
};

async function fetchFeed(
  url: string,
  fetchImpl: typeof fetch,
): Promise<{ items: FeedItem[] } | { error: string }> {
  try {
    const res = await fetchCapped(url, {
      accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml',
      maxBytes: MAX_FEED_BYTES,
      timeoutMs: 15_000,
      fetchImpl,
    });
    if (!res.ok) return { error: `http ${res.status}` };
    return { items: parseFeed(res.text()) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

async function uniqueSlug(orm: MikroORM, title: string): Promise<string> {
  const base = slugify(title, 170) || 'tin';
  for (let suffix = 1; ; suffix++) {
    const candidate = suffix === 1 ? base : `${base}-${suffix}`;
    const taken = await orm.em.fork().findOne(News, { slug: candidate }, { fields: ['id'] });
    if (!taken) return candidate;
  }
}

/** Download a photo, store it through the media pipeline and credit it. Returns the asset id, or null on any failure. */
async function ingestPhoto(
  deps: NewsImportDeps,
  photo: PhotoChoice,
  ownerId: string,
): Promise<string | null> {
  const fetchImpl = deps.fetchImpl ?? fetch;
  try {
    const res = await fetchCapped(photo.url, {
      maxBytes: MAX_IMAGE_BYTES,
      timeoutMs: 20_000,
      fetchImpl,
    });
    const mime = res.contentType.split(';')[0]?.trim() ?? '';
    if (!res.ok || !/^image\/(jpeg|png|webp)$/.test(mime)) return null;
    const bytes = res.bytes;
    if (bytes.byteLength === 0) return null;
    const id = randomUUID();
    const em = deps.orm.em.fork();
    const asset = em.create(MediaAsset, {
      id,
      ownerId,
      purpose: 'PRODUCT',
      visibility: 'PUBLIC',
      status: 'PROCESSING',
      mimeType: mime,
      sizeBytes: bytes.byteLength,
      sha256: createHash('sha256').update(bytes).digest('hex'),
      originalKey: `originals/${ownerId}/${id}`,
      altText: photo.description.slice(0, 500) || null,
      credit: {
        title: photo.title,
        author: photo.author,
        license: photo.license,
        licenseUrl: photo.licenseUrl,
        sourceUrl: photo.sourceUrl,
      },
    });
    await deps.storage.put({
      bucket: 'private',
      key: asset.originalKey,
      body: bytes,
      contentType: mime,
    });
    await em.flush();
    await processMediaAsset({ orm: deps.orm, storage: deps.storage }, id);
    const done = await deps.orm.em.fork().findOne(MediaAsset, id);
    return done?.status === 'READY' ? id : null;
  } catch (error) {
    deps.logger.warn(`photo ${photo.url} not ingested: ${(error as Error).message}`);
    return null;
  }
}

interface NewStory {
  title: string;
  summary: string;
  body: string;
  /** Start of the slug; the filler uses its topic key so a topic is not written twice. */
  slugBase?: string;
  category: 'GENERAL' | 'CRAFT_STORY';
  origin: NewsOrigin;
  publishedAt: Date;
  source?: { name: string; url: string; publishedAt: Date | null };
  photo: PhotoChoice | null;
  altVi: string;
  altEn: string;
}

const escapeHtml = (text: string) =>
  text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Store one story and its cover; the cover is skipped, never fatal, when no photo can be ingested. */
async function saveStory(deps: NewsImportDeps, ownerId: string, story: NewStory): Promise<string> {
  const assetId = story.photo ? await ingestPhoto(deps, story.photo, ownerId) : null;
  const em = deps.orm.em.fork();
  const slug = await uniqueSlug(deps.orm, story.slugBase ?? story.title);
  const bodyHtml = story.body
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, '<br>')}</p>`)
    .join('');
  const news = em.create(News, {
    slug,
    title: story.title.slice(0, 200),
    summary: story.summary.slice(0, 500),
    body: story.body,
    bodyHtml,
    category: story.category,
    status: deps.config.publish ? 'PUBLISHED' : 'DRAFT',
    publishedAt: deps.config.publish ? story.publishedAt : null,
    origin: story.origin,
    sourceName: story.source?.name.slice(0, 120) ?? null,
    sourceUrl: story.source?.url.slice(0, 500) ?? null,
    sourcePublishedAt: story.source?.publishedAt ?? null,
  });
  if (news.status === 'PUBLISHED' && news.publishedAt && news.publishedAt <= new Date())
    news.indexedAt = new Date();
  if (assetId)
    em.create(MediaLink, {
      media: em.getReference(MediaAsset, assetId),
      targetType: 'NEWS',
      targetId: news.id,
      role: 'COVER',
      altText: story.altVi,
      altEn: story.altEn,
    });
  queueKnowledgeChange(em, 'NEWS', news.id);
  await em.flush();
  return news.id;
}

/**
 * One run of the automatic import (GH#314). Fetches every configured feed (a bad feed is logged and skipped),
 * keeps stories about a covered village and craft, drops duplicates by canonical URL and near-identical title,
 * and stores at most `maxPerRun` new items with publisher, link and the original date. Then, when few stories
 * were published in the last 30 days, the filler may add evergreen articles. Never throws.
 */
export async function runNewsImport(deps: NewsImportDeps): Promise<NewsImportReport> {
  const report: NewsImportReport = {
    fetched: 0,
    imported: 0,
    generated: 0,
    skipped: {},
    feedErrors: 0,
  };
  const { config, logger } = deps;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const now = deps.now ?? new Date();
  const search = deps.searchPhotos ?? ((query: string) => searchCommons(query, fetchImpl));
  try {
    const admin = await deps.orm.em.fork().findOne(AppUser, { role: 'ADMIN' }, { fields: ['id'] });
    if (!admin) {
      logger.warn('news import: no administrator account to own the photos, nothing done');
      return report;
    }
    const known = (
      await deps.orm.em
        .fork()
        .find(
          News,
          {},
          { fields: ['title', 'sourceUrl'], orderBy: { createdAt: 'desc' }, limit: 3000 },
        )
    ).map((n) => ({ url: n.sourceUrl ?? null, title: n.title }));

    const candidates: Array<{ item: FeedItem; publisher: string }> = [];
    for (const feed of config.feeds) {
      const result = await fetchFeed(feed.url, fetchImpl);
      if ('error' in result) {
        report.feedErrors++;
        logger.warn(`news import: feed ${feed.url} failed: ${result.error}`);
        continue;
      }
      report.fetched += result.items.length;
      for (const item of result.items) candidates.push({ item, publisher: feed.publisher });
    }

    for (const { item, publisher } of candidates) {
      if (report.imported >= config.maxPerRun) {
        bump(report.skipped, 'run-limit');
        continue;
      }
      const verdict = relevance(item, config);
      if (verdict !== 'relevant') {
        bump(report.skipped, verdict);
        continue;
      }
      const duplicate = duplicateOf(item, known);
      if (duplicate) {
        bump(report.skipped, duplicate);
        continue;
      }
      try {
        const text = await storyText(deps.llm, item, publisher);
        const subject = `${config.villages[0] ?? ''} ${config.crafts[0] ?? ''}`.trim();
        const photo = choosePhoto(item, publisher, await search(subject));
        await saveStory(deps, admin.id, {
          title: item.title,
          ...text,
          category: 'GENERAL',
          origin: 'IMPORTED',
          publishedAt: item.publishedAt && item.publishedAt <= now ? item.publishedAt : now,
          source: { name: publisher, url: item.link, publishedAt: item.publishedAt },
          photo,
          altVi: `Ảnh về ${subject}`,
          altEn: `Photo of ${config.villages[0] ?? 'the village'} ${config.crafts[0] ?? ''}`.trim(),
        });
        known.push({ url: item.link, title: item.title });
        report.imported++;
      } catch (error) {
        bump(report.skipped, 'error');
        logger.warn(`news import: "${item.title}" failed: ${(error as Error).message}`);
      }
    }

    report.generated = await runFiller(deps, admin.id, search);
  } catch (error) {
    logger.warn(`news import aborted: ${(error as Error).message}`);
  }
  logger.log(
    `news import: fetched ${report.fetched}, imported ${report.imported}, generated ${report.generated}, skipped ${JSON.stringify(report.skipped)}, feed errors ${report.feedErrors}`,
  );
  return report;
}

/** Evergreen articles when fewer than the threshold of stories went live in the last 30 days; skipped without an LLM. */
async function runFiller(
  deps: NewsImportDeps,
  ownerId: string,
  search: (query: string) => Promise<CommonsCandidate[]>,
): Promise<number> {
  const { config, llm, logger } = deps;
  const now = deps.now ?? new Date();
  if (!llm) return 0;
  const since = new Date(now.getTime() - 30 * DAY_MS);
  const recent = await deps.orm.em
    .fork()
    .count(News, { status: 'PUBLISHED', publishedAt: { $gte: since, $lte: now } });
  if (!needsFiller(recent, config.fillerThreshold)) return 0;
  const generatedSlugs = (
    await deps.orm.em.fork().find(News, { origin: 'GENERATED' }, { fields: ['slug'] })
  ).map((n) => n.slug);
  let created = 0;
  const missing = config.fillerThreshold - recent;
  for (const topic of FILLER_TOPICS as readonly FillerTopic[]) {
    if (created >= missing) break;
    if (generatedSlugs.some((slug) => slug.startsWith(topic.key))) continue;
    try {
      const article = parseFillerArticle(await llm.completeJson(buildFillerPrompt(topic)));
      if (!article) {
        logger.warn(`filler: unusable answer for "${topic.key}"`);
        continue;
      }
      const photo = choosePhoto(
        { imageUrl: null, imageLicense: null, link: '', title: article.title },
        '',
        await search(topic.photoQuery),
      );
      await saveStory(deps, ownerId, {
        title: article.title,
        slugBase: topic.key,
        summary: article.summary,
        body: fillerBody(article),
        category: 'CRAFT_STORY',
        origin: 'GENERATED',
        publishedAt: now,
        photo,
        altVi: `Ảnh về ${topic.title}`,
        altEn: `Photo for: ${topic.title}`,
      });
      created++;
    } catch (error) {
      logger.warn(`filler: "${topic.key}" failed: ${(error as Error).message}`);
    }
  }
  return created;
}
