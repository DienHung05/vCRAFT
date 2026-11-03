import {
  ASSISTANT_HISTORY_MAX,
  type AssistantEvent,
  AssistantEventSchema,
  type CitationDto,
} from '@vcraft/contracts';

/**
 * Pure pieces of the Fox assistant widget (FR-AST-01, 04 … 06, PLAN E15 UX): the SSE parser, the
 * conversation kept in `sessionStorage`, the page kinds that pick quick questions and the thought lines.
 * No React here, so it is unit-tested on its own.
 */

export type ChatStatus = 'pending' | 'streaming' | 'done' | 'blocked' | 'error' | 'stopped';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status: ChatStatus;
  citations?: CitationDto[];
  /** The server's log id, for 👍/👎. */
  messageId?: string;
  blockReason?: Extract<AssistantEvent, { type: 'blocked' }>['reason'];
  /** Epoch ms when a rate-limited visitor may ask again. */
  retryAt?: number;
  feedback?: 'UP' | 'DOWN';
}

export interface Conversation {
  id: string;
  messages: ChatMessage[];
  /** Thought lines already shown this session, so none repeats. */
  seenThoughts: number[];
}

/** Splits an SSE byte stream into assistant events; malformed or unknown events are skipped. */
export function createSseParser(): (chunk: string) => AssistantEvent[] {
  let buffer = '';
  return (chunk) => {
    buffer += chunk.replace(/\r\n/g, '\n');
    const events: AssistantEvent[] = [];
    let end = buffer.indexOf('\n\n');
    while (end >= 0) {
      const block = buffer.slice(0, end);
      buffer = buffer.slice(end + 2);
      end = buffer.indexOf('\n\n');
      const data = block
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trimStart())
        .join('\n');
      if (!data) continue;
      try {
        const parsed = AssistantEventSchema.safeParse(JSON.parse(data));
        if (parsed.success) events.push(parsed.data);
      } catch {
        // A broken line is dropped; the stream goes on.
      }
    }
    return events;
  };
}

/** Earlier turns sent with a question: finished text only, the last ten, oldest first. */
export function historyOf(messages: readonly ChatMessage[]) {
  return messages
    .filter((m) => m.text.trim() && (m.role === 'user' || m.status === 'done'))
    .slice(-ASSISTANT_HISTORY_MAX)
    .map((m) => ({ role: m.role, content: m.text.slice(0, 4_000) }));
}

export const CONVERSATION_KEY = 'vcraft.assistant.conversation';
export const HELLO_KEY = 'vcraft.assistant.hello-dismissed';

export function newConversation(): Conversation {
  return { id: crypto.randomUUID(), messages: [], seenThoughts: [] };
}

/** The conversation of this tab, or a new one; storage that is blocked or corrupt starts afresh. */
export function loadConversation(storage: Pick<Storage, 'getItem'> | null): Conversation {
  try {
    const raw = storage?.getItem(CONVERSATION_KEY);
    if (!raw) return newConversation();
    const parsed = JSON.parse(raw) as Conversation;
    if (typeof parsed.id !== 'string' || !Array.isArray(parsed.messages)) return newConversation();
    // An answer cut off by a reload cannot resume: keep what arrived and mark it stopped.
    const messages = parsed.messages.map((m) =>
      m.status === 'pending' || m.status === 'streaming' ? { ...m, status: 'stopped' as const } : m,
    );
    return { id: parsed.id, messages, seenThoughts: parsed.seenThoughts ?? [] };
  } catch {
    return newConversation();
  }
}

export function saveConversation(
  storage: Pick<Storage, 'setItem'> | null,
  conversation: Conversation,
): void {
  try {
    storage?.setItem(CONVERSATION_KEY, JSON.stringify(conversation));
  } catch {
    // Private mode or a full quota: the conversation just won't survive a reload.
  }
}

export type PageKind = 'home' | 'catalog' | 'map' | 'trace' | 'quote' | 'other';

/** Which public page the widget sits on, from the localized pathname (`/vi/san-pham`, `/en/products`). */
export function pageKind(pathname: string): PageKind {
  const rest = pathname.replace(/^\/(vi|en)(?=\/|$)/, '') || '/';
  if (rest === '/') return 'home';
  if (/^\/(san-pham|products)(\/|$)/.test(rest)) return 'catalog';
  if (/^\/(ban-do|map)(\/|$)/.test(rest)) return 'map';
  if (/^\/(truy-xuat|trace)\//.test(rest)) return 'trace';
  if (/^\/(yeu-cau-bao-gia|quotes)(\/|$)/.test(rest)) return 'quote';
  return 'other';
}

/** Pages where the Fox says hello once on its own (never opening the panel). */
export const HELLO_PAGES: readonly PageKind[] = ['home', 'trace'];
export const HELLO_DELAY_MS = 8_000;

/**
 * Indices of thought lines not shown yet this session, shuffled; once all have been seen the cycle
 * starts over. `random` is injectable for tests.
 */
export function freshThoughts(
  total: number,
  seen: readonly number[],
  count = 4,
  random: () => number = Math.random,
): number[] {
  let pool = Array.from({ length: total }, (_, i) => i).filter((i) => !seen.includes(i));
  if (pool.length === 0) pool = Array.from({ length: total }, (_, i) => i);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j] as number, pool[i] as number];
  }
  return pool.slice(0, count);
}

/** Whole seconds left before `retryAt`, never negative. */
export function secondsLeft(retryAt: number | undefined, now: number): number {
  return retryAt ? Math.max(0, Math.ceil((retryAt - now) / 1000)) : 0;
}
