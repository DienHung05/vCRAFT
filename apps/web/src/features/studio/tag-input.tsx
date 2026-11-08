'use client';

import { MAX_PRODUCT_TAG_LENGTH, MAX_PRODUCT_TAGS, normalizeTags, tagKey } from '@vcraft/domain';
import { Badge } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useId, useState } from 'react';
import { inputClass } from './workshop-editor';

/** Tags the household already uses on its other products, without those already chosen. */
export function tagSuggestions(
  used: readonly (readonly string[])[],
  chosen: readonly string[],
): string[] {
  const taken = new Set(chosen.map(tagKey));
  return normalizeTags(used.flat(), Number.POSITIVE_INFINITY).filter(
    (tag) => !taken.has(tagKey(tag)),
  );
}

/**
 * Chip input for product tags (FR-PRD-01): Enter or a comma adds the typed tag, Backspace on an empty
 * field removes the last one, and the household's existing tags are offered as suggestions.
 */
export function TagInput({
  value,
  onChange,
  suggestions = [],
}: {
  value: readonly string[];
  onChange: (tags: string[]) => void;
  suggestions?: readonly string[];
}) {
  const t = useTranslations('studio.products');
  const [text, setText] = useState('');
  const hintId = useId();
  const full = value.length >= MAX_PRODUCT_TAGS;
  const offered = suggestions
    .filter((tag) => !value.some((chosen) => tagKey(chosen) === tagKey(tag)))
    .slice(0, 8);

  const commit = (raw: string) => {
    const next = normalizeTags([...value, raw]);
    if (next.length > value.length) onChange(next);
    setText('');
  };

  return (
    <div className="flex flex-col gap-2 text-small">
      <label className="flex flex-col gap-1">
        {t('tags')}
        <input
          value={text}
          maxLength={MAX_PRODUCT_TAG_LENGTH}
          disabled={full}
          placeholder={t('tagsPlaceholder')}
          aria-describedby={hintId}
          onChange={(event) => {
            const typed = event.target.value;
            // A pasted or typed comma ends the tag.
            if (typed.includes(',')) {
              for (const part of typed.split(',')) if (part.trim()) commit(part);
              setText('');
              return;
            }
            setText(typed);
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              // Adding a tag must not submit the surrounding form.
              event.preventDefault();
              if (text.trim()) commit(text);
            } else if (event.key === 'Backspace' && text === '' && value.length > 0) {
              onChange(value.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (text.trim()) commit(text);
          }}
          className={inputClass}
        />
      </label>
      <p id={hintId} className="text-ash">
        {full ? t('tagsFull', { max: MAX_PRODUCT_TAGS }) : t('tagsHint', { max: MAX_PRODUCT_TAGS })}
      </p>
      {value.length > 0 ? (
        <ul className="flex flex-wrap gap-2" aria-label={t('tagsChosen')}>
          {value.map((tag) => (
            <li key={tagKey(tag)}>
              <Badge tone="outline" className="gap-1 normal-case">
                {tag}
                <button
                  type="button"
                  aria-label={t('tagRemove', { tag })}
                  onClick={() => onChange(value.filter((other) => other !== tag))}
                  className="-mr-1 rounded-chip px-1 hover:text-seal"
                >
                  ×
                </button>
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      {offered.length > 0 && !full ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-ash">{t('tagsSuggested')}</span>
          {offered.map((tag) => (
            <button
              key={tagKey(tag)}
              type="button"
              onClick={() => commit(tag)}
              className="rounded-chip border border-ink/15 px-2.5 py-1 hover:bg-clay/12"
            >
              + {tag}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
