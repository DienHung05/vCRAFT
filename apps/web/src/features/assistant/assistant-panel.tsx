'use client';

import { ASSISTANT_MESSAGE_MAX } from '@vcraft/contracts';
import {
  ArrowLeft,
  Check,
  Copy,
  History,
  RotateCcw,
  Send,
  Square,
  SquarePen,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  X,
} from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { type ChatMessage, type PageKind, secondsLeft } from './conversation';
import type { ArchivedConversation } from './conversation-archive';
import styles from './pending-indicator.module.css';

/** Internal markdown links (`[label](/vi/...)`) become anchors; everything else stays plain text. */
function renderText(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  // Whitespace inside the parentheses is tolerated, as in the server-side link filter (`[text]( /path )`).
  const link = /\[([^\]]+)\]\(\s*(\/(?!\/)[^)\s]*)\s*\)/g;
  let last = 0;
  for (const match of text.matchAll(link)) {
    parts.push(text.slice(last, match.index));
    parts.push(
      <a key={match.index} href={match[2]} className="text-clay underline underline-offset-2">
        {match[1]}
      </a>,
    );
    last = (match.index ?? 0) + match[0].length;
  }
  parts.push(text.slice(last));
  return parts;
}

function useNow(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

const iconButton =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-input text-ink/60 transition-colors hover:bg-ink/6 hover:text-ink disabled:opacity-40';

function AnswerTools({
  message,
  onRate,
  onRetry,
  canRetry,
}: {
  message: ChatMessage;
  onRate: (rating: 'UP' | 'DOWN') => void;
  onRetry: () => void;
  canRetry: boolean;
}) {
  const t = useTranslations('assistant');
  const [copied, setCopied] = useState(false);
  if (message.status === 'error' || message.status === 'stopped')
    return canRetry ? (
      <button
        type="button"
        onClick={onRetry}
        className={`${iconButton} w-auto gap-1 self-start px-2 text-small`}
      >
        <RotateCcw className="size-4" aria-hidden />
        {t('retry')}
      </button>
    ) : null;
  if (message.status !== 'done' || !message.text) return null;
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={iconButton}
        aria-label={copied ? t('copied') : t('copy')}
        onClick={() => {
          void navigator.clipboard?.writeText(message.text).then(() => setCopied(true));
        }}
      >
        {copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </button>
      {message.messageId && (
        <>
          <button
            type="button"
            className={iconButton}
            aria-label={t('helpful')}
            aria-pressed={message.feedback === 'UP'}
            disabled={message.feedback !== undefined}
            onClick={() => onRate('UP')}
          >
            <ThumbsUp className="size-4" aria-hidden />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={t('notHelpful')}
            aria-pressed={message.feedback === 'DOWN'}
            disabled={message.feedback !== undefined}
            onClick={() => onRate('DOWN')}
          >
            <ThumbsDown className="size-4" aria-hidden />
          </button>
        </>
      )}
    </div>
  );
}

function Bubble({ message, now, tools }: { message: ChatMessage; now: number; tools: ReactNode }) {
  const t = useTranslations('assistant');
  if (message.role === 'user')
    return (
      <li className="ml-8 self-end rounded-card bg-ink px-3 py-2 text-paper whitespace-pre-wrap break-words">
        {message.text}
      </li>
    );
  const wait = secondsLeft(message.retryAt, now);
  let body: ReactNode = renderText(message.text);
  if (message.status === 'pending')
    body = (
      <span className="inline-flex min-h-5 items-center gap-1.5 text-clay">
        <span className="sr-only">{t('thinking')}</span>
        <span aria-hidden="true" className="inline-flex items-center gap-1.5">
          {[0, 1, 2].map((dot) => (
            <span
              key={dot}
              className={`${styles.dot} size-1.5 rounded-full bg-current`}
              style={{ animationDelay: `${dot * 160}ms` }}
            />
          ))}
        </span>
      </span>
    );
  if (message.status === 'blocked')
    body =
      message.blockReason === 'RATE_LIMITED' && wait > 0
        ? t('blocked.RATE_LIMITED_WAIT', { seconds: wait })
        : t(`blocked.${message.blockReason ?? 'DISABLED'}`);
  if (message.status === 'error') body = message.text ? body : t('error');
  return (
    <li className="mr-8 flex flex-col gap-2 self-start">
      <div className="rounded-card bg-surface px-3 py-2 whitespace-pre-wrap break-words ring-1 ring-ink/8">
        {body}
        {message.status === 'stopped' && (
          <span className="block text-small text-ink/60">{t('stopped')}</span>
        )}
      </div>
      {message.citations && message.citations.length > 0 && (
        <ul className="flex flex-col gap-1" aria-label={t('sources')}>
          {message.citations.map((c) => (
            <li key={c.url}>
              <a
                href={c.url}
                className="block rounded-input px-3 py-2 text-small ring-1 ring-ink/8 transition-colors hover:bg-ink/6"
              >
                <span className="block text-ink/60">{t(`source.${c.type}`)}</span>
                <span className="block font-medium">{c.title}</span>
              </a>
            </li>
          ))}
        </ul>
      )}
      {tools}
    </li>
  );
}

export interface AssistantPanelProps {
  archive: readonly ArchivedConversation[];
  onHistory: () => void;
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
  messages: readonly ChatMessage[];
  busy: boolean;
  page: PageKind;
  onSend: (text: string) => void;
  onStop: () => void;
  onRetry: () => void;
  onReset: () => void;
  onRate: (message: ChatMessage, rating: 'UP' | 'DOWN') => void;
  onClose: () => void;
  /** The Fox, rendered by the container in the panel header. */
  mascot: ReactNode;
}

/** The chat itself: header, messages, quick questions and the input (FR-AST-04, 05). */
export function AssistantPanel({
  archive,
  onHistory,
  onRestore,
  onDelete,
  messages,
  busy,
  page,
  onSend,
  onStop,
  onRetry,
  onReset,
  onRate,
  onClose,
  mascot,
}: AssistantPanelProps) {
  const t = useTranslations('assistant');
  const locale = useLocale();
  const [showHistory, setShowHistory] = useState(false);
  const back = useRef<HTMLButtonElement>(null);
  const historyButton = useRef<HTMLButtonElement>(null);
  const [draft, setDraft] = useState('');
  const list = useRef<HTMLOListElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const last = messages.at(-1);
  const waiting = last?.status === 'blocked' && last.blockReason === 'RATE_LIMITED';
  const now = useNow(waiting === true);
  const locked = waiting && secondsLeft(last?.retryAt, now) > 0;

  useEffect(() => {
    if (showHistory) back.current?.focus();
    else if (input.current?.disabled) historyButton.current?.focus();
    else input.current?.focus();
  }, [showHistory]);
  // Keep the newest text in view while it streams.
  const tail = `${messages.length}:${last?.text.length ?? 0}:${last?.status}`;
  useEffect(() => {
    void tail;
    const el = list.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [tail]);

  const submit = () => {
    if (!draft.trim() || busy || locked) return;
    onSend(draft);
    setDraft('');
  };
  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
      event.preventDefault();
      submit();
    }
  };
  const chips = t.raw(`quick.${page}`) as string[];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex items-center gap-2 border-ink/8 border-b px-3 py-2">
        <div className="shrink-0">{mascot}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{t('title')}</p>
          <p className="truncate text-small text-ink/60">{t('subtitle')}</p>
        </div>
        <button
          type="button"
          className={iconButton}
          ref={historyButton}
          aria-label={t('history')}
          aria-pressed={showHistory}
          onClick={() => {
            onHistory();
            setShowHistory(true);
          }}
        >
          <History className="size-4" aria-hidden />
        </button>
        <button
          type="button"
          className={iconButton}
          aria-label={t('newChat')}
          onClick={() => {
            onReset();
            setDraft('');
            setShowHistory(false);
            input.current?.focus();
          }}
        >
          <SquarePen className="size-4" aria-hidden />
        </button>
        <button type="button" className={iconButton} aria-label={t('close')} onClick={onClose}>
          <X className="size-4" aria-hidden />
        </button>
      </div>

      {showHistory ? (
        <section aria-label={t('history')} className="flex min-h-0 flex-1 flex-col">
          <button
            ref={back}
            type="button"
            aria-label={t('backToChat')}
            className="flex shrink-0 items-center gap-2 self-start rounded-input px-3 py-3 text-small hover:bg-ink/6"
            onClick={() => setShowHistory(false)}
          >
            <ArrowLeft className="size-4" aria-hidden />
            {t('backToChat')}
          </button>
          <h2 className="px-3 pb-2 font-sans text-base font-medium text-ink">{t('history')}</h2>
          {archive.length === 0 ? (
            <p role="status" className="px-3 py-3 text-small text-ink/60">
              {t('historyEmpty')}
            </p>
          ) : (
            <ul
              aria-label={t('history')}
              className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3"
            >
              {archive.map((entry) => {
                const question =
                  entry.messages.find((message) => message.role === 'user')?.text ?? t('newChat');
                const title = question.length > 80 ? `${question.slice(0, 80)}…` : question;
                return (
                  <li key={entry.id} className="flex items-center gap-2 border-ink/8 border-b py-1">
                    <button
                      type="button"
                      aria-label={title}
                      className="min-w-0 flex-1 rounded-input px-2 py-2 text-left hover:bg-ink/6"
                      onClick={() => {
                        onRestore(entry.id);
                        setDraft('');
                        setShowHistory(false);
                      }}
                    >
                      <span className="block truncate text-small font-medium">{title}</span>
                      <time
                        dateTime={new Date(entry.savedAt).toISOString()}
                        className="block text-small text-ink/60"
                      >
                        {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(
                          entry.savedAt,
                        )}
                      </time>
                    </button>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={t('deleteConversation')}
                      onClick={() => {
                        onDelete(entry.id);
                        back.current?.focus();
                      }}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ) : (
        <>
          <ol
            ref={list}
            aria-live="polite"
            aria-label={t('log')}
            className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-3 py-3"
          >
            {messages.length === 0 && (
              <li className="mr-8 self-start rounded-card bg-surface px-3 py-2 ring-1 ring-ink/8">
                {t('welcome')}
              </li>
            )}
            {messages.map((m) => (
              <Bubble
                key={m.id}
                message={m}
                now={now}
                tools={
                  m.role === 'assistant' && (
                    <AnswerTools
                      message={m}
                      canRetry={m === last && !busy}
                      onRetry={onRetry}
                      onRate={(rating) => onRate(m, rating)}
                    />
                  )
                }
              />
            ))}
          </ol>

          {messages.length === 0 && (
            <ul className="flex flex-wrap gap-2 px-3 pb-2" aria-label={t('quickLabel')}>
              {chips.map((chip) => (
                <li key={chip}>
                  <button
                    type="button"
                    className="rounded-chip px-3 py-1.5 text-small ring-1 ring-ink/15 transition-colors hover:bg-ink/6"
                    onClick={() => onSend(chip)}
                  >
                    {chip}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <form
            className="flex items-end gap-2 border-ink/8 border-t px-3 py-2"
            onSubmit={(event) => {
              event.preventDefault();
              submit();
            }}
          >
            <label htmlFor="assistant-input" className="sr-only">
              {t('inputLabel')}
            </label>
            <textarea
              id="assistant-input"
              ref={input}
              rows={1}
              maxLength={ASSISTANT_MESSAGE_MAX}
              value={draft}
              disabled={locked}
              placeholder={t('placeholder')}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={onKeyDown}
              className="max-h-32 min-h-10 min-w-0 flex-1 resize-none rounded-input bg-paper px-3 py-2 text-base ring-1 ring-ink/15 focus:outline-none focus:ring-2 focus:ring-clay"
            />
            {busy ? (
              <button type="button" className={iconButton} aria-label={t('stop')} onClick={onStop}>
                <Square className="size-4" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                className={iconButton}
                aria-label={t('send')}
                disabled={!draft.trim() || locked}
              >
                <Send className="size-4" aria-hidden />
              </button>
            )}
          </form>
        </>
      )}
    </div>
  );
}
