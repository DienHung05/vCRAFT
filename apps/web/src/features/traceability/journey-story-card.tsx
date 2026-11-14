'use client';

import type { JournalStage } from '@vcraft/domain';
import { cn } from '@vcraft/ui';
import { useTranslations } from 'next-intl';
import { useRichMotion } from '@/experience/motion/use-motion';
import { vietnameseOnlyLang } from '@/lib/vietnamese-text';
import {
  ChainBrokenAlert,
  JourneyTrust,
  useChainVerification,
  type VerifiableEntry,
} from './chain-verifier';
import { useJourneyStory } from './journey-story-context';
import './trace-story.css';

export interface StoryCardChapter {
  seq: number;
  stage: JournalStage;
  title: string;
  date: string;
  gap?: string;
  body: string;
  note?: string;
}

/**
 * The left page of the trace spread: the story of the piece, told from its journal. Where the timeline is
 * scroll-synced (wide screen, motion allowed) it shows the chapter of the step in focus and follows the stages
 * as a sticky card; everywhere else, and before hydration, it shows the prologue, and the chapters read inline
 * inside each step of the timeline. A trust line closes the card; a journal that fails the browser's check is
 * announced at the very top.
 */
export function JourneyStoryCard({
  productId,
  entries,
  household,
  householdVerified,
  locale,
  prologue,
  epilogue,
  chapters,
  subtle,
}: {
  productId: string;
  entries: readonly VerifiableEntry[];
  household: string;
  householdVerified?: boolean | undefined;
  locale: string;
  prologue: string;
  epilogue: string;
  chapters: readonly StoryCardChapter[];
  /** `SubtleCrypto` replacement, for tests. */
  subtle?: SubtleCrypto;
}) {
  const t = useTranslations('trace.story');
  const stages = useTranslations('stages');
  const motion = useRichMotion({ minWidth: 1024 });
  const shared = useJourneyStory();
  const state = useChainVerification(productId, entries, subtle);
  const story = motion && chapters.length > 0;
  const index = Math.min(shared?.active ?? 0, Math.max(chapters.length - 1, 0));
  const chapter = chapters[index];
  const last = index === chapters.length - 1;

  return (
    <section
      id="story"
      aria-labelledby="story-title"
      data-state={state.status}
      data-story={story ? 'on' : undefined}
      className="journey-story relative mx-5 mt-8 rounded-card bg-surface p-6 shadow-warm"
    >
      {state.status === 'broken' ? <ChainBrokenAlert state={state} entries={entries} /> : null}
      <h2 id="story-title" className="text-small font-medium tracking-wider text-clay uppercase">
        {t('kicker')}
      </h2>

      {story && chapter ? (
        <div className="journey-story-scroll">
          {index === 0 ? <p className="mt-3 text-ink/85">{prologue}</p> : null}
          <article key={chapter.seq} className="journey-chapter mt-4" aria-live="polite">
            <p className="font-mono text-[0.75rem] tracking-wider text-ash">
              {t('chapterOf', {
                n: index + 1,
                total: chapters.length,
                stage: stages(`${chapter.stage}.name`),
              })}{' '}
              · <span>{chapter.date}</span>
              {chapter.gap ? ` · ${chapter.gap}` : ''}
            </p>
            <h3 className="mt-1 font-display text-h3">{chapter.title}</h3>
            <p className="mt-2 text-ink/90">{chapter.body}</p>
            {chapter.note ? (
              <figure className="mt-3 border-clay/40 border-l-2 pl-3">
                <blockquote lang={vietnameseOnlyLang(locale)} className="break-words text-ink/85">
                  “{chapter.note}”
                </blockquote>
                <figcaption className="mt-1 text-small text-ash">
                  — {t('quoteBy', { household })}
                </figcaption>
              </figure>
            ) : null}
          </article>
          {last ? <p className="mt-4 text-ink/85">{epilogue}</p> : null}
          <nav aria-label={t('chapterDots')} className="mt-4">
            <ol className="flex flex-wrap gap-1">
              {chapters.map((c, i) => (
                <li key={c.seq}>
                  <button
                    type="button"
                    aria-label={t('goToChapter', { n: i + 1, stage: stages(`${c.stage}.name`) })}
                    aria-current={i === index ? 'step' : undefined}
                    onClick={() => shared?.goTo(i)}
                    className="grid size-6 place-items-center rounded-full"
                  >
                    <span
                      className={cn(
                        'size-2.5 rounded-full transition-colors',
                        i === index ? 'bg-clay' : 'bg-ash/40',
                      )}
                    />
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      ) : (
        <p className="mt-3 text-ink/85">{prologue}</p>
      )}

      <JourneyTrust state={state} household={household} householdVerified={householdVerified} />
    </section>
  );
}
