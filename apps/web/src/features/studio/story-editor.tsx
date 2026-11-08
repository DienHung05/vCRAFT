'use client';

import { Button } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { StoryText } from '@/features/exhibition/story-text';
import {
  insertLink,
  isAllowedLinkUrl,
  type TextEdit,
  toggleBullets,
  toggleWrap,
} from './story-format';
import { inputClass } from './workshop-editor';

/**
 * The household story editor (FR-ART-01): a plain textarea with a tiny toolbar for bold, italic, bulleted
 * lists and links. The text is stored as a restricted Markdown subset, so it stays readable everywhere and
 * the public page renders it without raw HTML. A live preview shows what visitors will see.
 */
export function StoryEditor({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (value: string) => void;
}) {
  const t = useTranslations('studio.profile.storyEditor');
  const area = useRef<HTMLTextAreaElement>(null);
  const restore = useRef<{ start: number; end: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [url, setUrl] = useState('https://');
  const [urlInvalid, setUrlInvalid] = useState(false);
  // The textarea loses its selection while the link field has focus, so it is remembered here.
  const selection = useRef({ start: 0, end: 0 });

  // Put the selection back after React has written the new text into the textarea.
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs after every text change by design.
  useEffect(() => {
    const target = restore.current;
    const element = area.current;
    if (!target || !element) return;
    restore.current = null;
    element.focus();
    element.setSelectionRange(target.start, target.end);
  }, [value]);

  const remember = () => {
    const element = area.current;
    if (element) selection.current = { start: element.selectionStart, end: element.selectionEnd };
  };

  const apply = (make: (start: number, end: number) => TextEdit) => {
    remember();
    const edit = make(selection.current.start, selection.current.end);
    restore.current = { start: edit.start, end: edit.end };
    onChange(edit.value);
  };

  const submitLink = () => {
    const address = url.trim();
    if (!isAllowedLinkUrl(address)) return setUrlInvalid(true);
    const { start, end } = selection.current;
    const edit = insertLink(value, start, end, address, t('linkText'));
    restore.current = { start: edit.start, end: edit.end };
    onChange(edit.value);
    setLinkOpen(false);
    setUrl('https://');
    setUrlInvalid(false);
  };

  return (
    <div className="flex flex-col gap-2">
      <div role="toolbar" aria-label={t('toolbar')} className="flex flex-wrap gap-1">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => apply((s, e) => toggleWrap(value, s, e, '**', t('bold').toLowerCase()))}
        >
          <strong>{t('bold')}</strong>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => apply((s, e) => toggleWrap(value, s, e, '*', t('italic').toLowerCase()))}
        >
          <em>{t('italic')}</em>
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          onClick={() => apply((s, e) => toggleBullets(value, s, e))}
        >
          {t('bullet')}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="secondary"
          aria-expanded={linkOpen}
          onClick={() => {
            remember();
            setLinkOpen((open) => !open);
          }}
        >
          {t('link')}
        </Button>
      </div>
      {linkOpen ? (
        <div className="flex flex-wrap items-end gap-2">
          <label className="flex min-w-60 flex-1 flex-col gap-1 text-small">
            {t('linkUrl')}
            <input
              value={url}
              type="url"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              aria-invalid={urlInvalid || undefined}
              onChange={(event) => {
                setUrl(event.target.value);
                setUrlInvalid(false);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  submitLink();
                }
              }}
              className={inputClass}
            />
          </label>
          <Button type="button" size="sm" onClick={submitLink}>
            {t('linkInsert')}
          </Button>
          <Button type="button" size="sm" variant="ghost" onClick={() => setLinkOpen(false)}>
            {t('linkCancel')}
          </Button>
          {urlInvalid ? (
            <p role="alert" className="w-full text-small text-seal">
              {t('linkInvalid')}
            </p>
          ) : null}
        </div>
      ) : null}
      <label className="flex flex-col gap-1 text-small">
        {label}
        <textarea
          ref={area}
          rows={9}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onSelect={remember}
          onBlur={remember}
          className={inputClass}
        />
      </label>
      <p className="text-small text-ash">{t('hint')}</p>
      {value.trim() ? (
        <section
          aria-label={t('preview')}
          className="rounded-input border border-ink/10 bg-paper px-4 pb-4"
        >
          <p className="mt-3 text-small text-ash">{t('preview')}</p>
          <StoryText source={value} />
        </section>
      ) : null}
    </div>
  );
}
