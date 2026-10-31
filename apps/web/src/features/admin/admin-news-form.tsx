'use client';

import { type AdminClient, ApiError } from '@vcraft/api-client';
import type { AdminNewsDto, SaveNewsRequest } from '@vcraft/contracts';
import { NEWS_CATEGORIES, NEWS_VISIBILITIES, type NewsCategory } from '@vcraft/domain';
import { Button } from '@vcraft/ui';
import dynamic from 'next/dynamic';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { prepareImage, sendMedia } from '@/features/media/prepare-image';
import { Link, useRouter } from '@/i18n/navigation';
import { browserAccessToken } from '@/lib/api/live-session';
import { useAdminClient } from './admin-dashboard';

// The editor is heavy and only works in the browser.
const RichTextEditor = dynamic(
  () => import('./rich-text-editor').then((module) => module.RichTextEditor),
  { ssr: false },
);

const inputClass = 'w-full rounded-input border border-ink/20 bg-surface px-3 py-2 text-body';
const COVER_POLL_MS = 1500;
const COVER_POLL_ATTEMPTS = 20;
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

type Publication = 'draft' | 'now' | 'schedule';

interface Values {
  title: string;
  slug: string;
  summary: string;
  bodyHtml: string;
  bodyEmpty: boolean;
  category: NewsCategory;
  visibility: SaveNewsRequest['visibility'];
  pinned: boolean;
  important: boolean;
  publication: Publication;
  publishAt: string;
  coverAlt: string;
}

const EMPTY: Values = {
  title: '',
  slug: '',
  summary: '',
  bodyHtml: '',
  bodyEmpty: true,
  category: 'GENERAL',
  visibility: 'PUBLIC',
  pinned: false,
  important: false,
  publication: 'draft',
  publishAt: '',
  coverAlt: '',
};

/** `datetime-local` works in the viewer's clock, so it is converted through local time. */
const toLocalInput = (iso: string) => {
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const valuesOf = (news: AdminNewsDto): Values => ({
  title: news.title,
  slug: news.slug,
  summary: news.summary,
  bodyHtml: news.bodyHtml,
  bodyEmpty: false,
  category: news.category,
  visibility: news.visibility,
  pinned: news.pinned,
  important: news.important,
  publication: news.state === 'DRAFT' ? 'draft' : news.state === 'SCHEDULED' ? 'schedule' : 'now',
  publishAt: news.state === 'SCHEDULED' && news.publishedAt ? toLocalInput(news.publishedAt) : '',
  coverAlt: news.cover?.alt ?? '',
});

type Field = 'title' | 'summary' | 'body' | 'publishAt' | 'slug';

export function newsFormProblems(values: Values, now = new Date()): Partial<Record<Field, true>> {
  const problems: Partial<Record<Field, true>> = {};
  if (!values.title.trim()) problems.title = true;
  if (!values.summary.trim()) problems.summary = true;
  if (values.bodyEmpty) problems.body = true;
  if (values.slug && !SLUG.test(values.slug)) problems.slug = true;
  if (values.publication === 'schedule' && (!values.publishAt || new Date(values.publishAt) <= now))
    problems.publishAt = true;
  return problems;
}

async function uploadCover(client: AdminClient, file: File): Promise<string> {
  const { signal } = new AbortController();
  const prepared = await prepareImage(file, signal);
  const uploaded = await sendMedia(
    prepared.file,
    'PRODUCT',
    browserAccessToken() ?? (async () => null),
    () => {},
    signal,
  );
  for (let attempt = 0; attempt < COVER_POLL_ATTEMPTS; attempt++) {
    const asset = await client.getMedia(uploaded.id);
    if (asset.status === 'READY') return asset.id;
    if (asset.status === 'FAILED') break;
    await new Promise((resolve) => setTimeout(resolve, COVER_POLL_MS));
  }
  throw new Error('cover-not-ready');
}

/** Create and edit form for news (FR-NEWS-01, 02, 05). */
export function AdminNewsForm({
  newsId,
  client: provided,
  upload = uploadCover,
}: {
  newsId?: string;
  client?: AdminClient;
  upload?: (client: AdminClient, file: File) => Promise<string>;
}) {
  const t = useTranslations('admin.news');
  const form = useTranslations('admin.news.form');
  const categories = useTranslations('indexPages.news.categories');
  const router = useRouter();
  const { client, loading } = useAdminClient(provided);
  const [values, setValues] = useState<Values>(EMPTY);
  const [existing, setExisting] = useState<AdminNewsDto | null>(null);
  const [state, setState] = useState<'loading' | 'ready' | 'failed'>(newsId ? 'loading' : 'ready');
  const [cover, setCover] = useState<File | null>(null);
  const [removeCover, setRemoveCover] = useState(false);
  const [showProblems, setShowProblems] = useState(false);
  const [saving, setSaving] = useState<'idle' | 'cover' | 'saving'>('idle');
  const [saveError, setSaveError] = useState<
    'failed' | 'stale' | 'slugTaken' | 'coverFailed' | null
  >(null);

  useEffect(() => {
    if (!newsId || !client) return;
    client
      .getNews(newsId)
      .then((news) => {
        setExisting(news);
        setValues(valuesOf(news));
        setState('ready');
      })
      .catch(() => setState('failed'));
  }, [newsId, client]);

  if (!loading && !client) return <p>{t('signIn')}</p>;
  if (state === 'failed') return <p role="alert">{t('failed')}</p>;
  if (state === 'loading' || !client) return <p role="status">{t('loading')}</p>;

  const set = <K extends keyof Values>(key: K, value: Values[K]) =>
    setValues((current) => ({ ...current, [key]: value }));
  const problems = newsFormProblems(values);
  const problem = (field: Field) =>
    showProblems && problems[field] ? (
      <span role="alert" className="text-small text-seal">
        {form(`problem.${field}`)}
      </span>
    ) : null;

  const save = async () => {
    setSaveError(null);
    if (Object.keys(problems).length > 0) {
      setShowProblems(true);
      return;
    }
    let coverMediaId: string | null | undefined;
    if (cover) {
      setSaving('cover');
      try {
        coverMediaId = await upload(client, cover);
      } catch {
        setSaveError('coverFailed');
        setSaving('idle');
        return;
      }
    } else if (removeCover) coverMediaId = null;
    setSaving('saving');
    const body: SaveNewsRequest = {
      title: values.title.trim(),
      ...(values.slug ? { slug: values.slug } : {}),
      summary: values.summary.trim(),
      bodyHtml: values.bodyHtml,
      category: values.category,
      visibility: values.visibility,
      pinned: values.pinned,
      important: values.important,
      status: values.publication === 'draft' ? 'DRAFT' : 'PUBLISHED',
      ...(values.publication === 'schedule'
        ? { publishAt: new Date(values.publishAt).toISOString() }
        : {}),
      ...(coverMediaId !== undefined ? { coverMediaId } : {}),
      ...(values.coverAlt.trim() ? { coverAlt: values.coverAlt.trim() } : {}),
    };
    try {
      if (existing) await client.updateNews(existing.id, existing.version, body);
      else await client.createNews(body);
      router.push('/admin/tin-tuc');
    } catch (error) {
      const code = error instanceof ApiError ? error.code : null;
      setSaveError(
        code === 'STALE_VERSION' ? 'stale' : code === 'CONFLICT_DUPLICATE' ? 'slugTaken' : 'failed',
      );
      setSaving('idle');
    }
  };

  return (
    <form
      noValidate
      className="mx-auto flex max-w-3xl flex-col gap-5"
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <nav className="text-small text-ash">
        <Link href="/admin/tin-tuc" className="hover:text-clay">
          {t('back')}
        </Link>
      </nav>
      <h1 className="text-h2">{t(existing ? 'editTitle' : 'newTitle')}</h1>
      <label className="flex flex-col gap-1">
        {form('title')}
        <input
          value={values.title}
          maxLength={200}
          onChange={(event) => set('title', event.target.value)}
          className={inputClass}
        />
        {problem('title')}
      </label>
      <label className="flex flex-col gap-1">
        {form('slug')}
        <input
          value={values.slug}
          maxLength={160}
          onChange={(event) => set('slug', event.target.value)}
          className={inputClass}
        />
        <span className="text-small text-ash">{form('slugHint')}</span>
        {problem('slug')}
      </label>
      <label className="flex flex-col gap-1">
        {form('summary')}
        <textarea
          rows={2}
          maxLength={500}
          value={values.summary}
          onChange={(event) => set('summary', event.target.value)}
          className={inputClass}
        />
        {problem('summary')}
      </label>
      <div className="flex flex-col gap-1">
        <span>{form('body')}</span>
        <RichTextEditor
          value={values.bodyHtml}
          label={form('body')}
          invalid={showProblems && Boolean(problems.body)}
          onChange={(html, isEmpty) =>
            setValues((current) => ({ ...current, bodyHtml: html, bodyEmpty: isEmpty }))
          }
        />
        {problem('body')}
      </div>
      <div className="grid gap-5 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          {form('category')}
          <select
            value={values.category}
            onChange={(event) => set('category', event.target.value as NewsCategory)}
            className={inputClass}
          >
            {NEWS_CATEGORIES.map((category) => (
              <option key={category} value={category}>
                {categories(category)}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          {form('visibility')}
          <select
            value={values.visibility}
            onChange={(event) => set('visibility', event.target.value as Values['visibility'])}
            className={inputClass}
          >
            {NEWS_VISIBILITIES.map((visibility) => (
              <option key={visibility} value={visibility}>
                {t(`visibility.${visibility}`)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1">
        {form('cover')}
        {existing?.cover && !removeCover && !cover ? (
          // biome-ignore lint/performance/noImgElement: a small admin preview of an image from a storage host that varies by deployment.
          <img src={existing.cover.url} alt={existing.cover.alt} className="max-h-40 w-fit" />
        ) : null}
        <input
          type="file"
          accept="image/*"
          onChange={(event) => setCover(event.target.files?.[0] ?? null)}
        />
      </label>
      {existing?.cover && !cover ? (
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={removeCover}
            onChange={(event) => setRemoveCover(event.target.checked)}
          />
          {form('removeCover')}
        </label>
      ) : null}
      <label className="flex flex-col gap-1">
        {form('coverAlt')}
        <input
          value={values.coverAlt}
          maxLength={500}
          onChange={(event) => set('coverAlt', event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.pinned}
          onChange={(event) => set('pinned', event.target.checked)}
        />
        {form('pinned')}
      </label>
      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={values.important}
          onChange={(event) => set('important', event.target.checked)}
        />
        {form('important')}
      </label>
      <fieldset className="flex flex-col gap-2">
        <legend>{form('publication')}</legend>
        {(['draft', 'now', 'schedule'] as const).map((option) => (
          <label key={option} className="flex items-center gap-2">
            <input
              type="radio"
              name="publication"
              checked={values.publication === option}
              onChange={() => set('publication', option)}
            />
            {form(option)}
          </label>
        ))}
        {values.publication === 'schedule' ? (
          <label className="flex max-w-xs flex-col gap-1">
            {form('publishAt')}
            <input
              type="datetime-local"
              value={values.publishAt}
              onChange={(event) => set('publishAt', event.target.value)}
              className={inputClass}
            />
            {problem('publishAt')}
          </label>
        ) : null}
      </fieldset>
      {saveError ? (
        <p role="alert" className="text-seal">
          {form(saveError)}
        </p>
      ) : null}
      <Button type="submit" className="self-start" disabled={saving !== 'idle'}>
        {saving === 'cover'
          ? form('coverUploading')
          : saving === 'saving'
            ? form('saving')
            : form('save')}
      </Button>
    </form>
  );
}
