import { ASSISTANT_MESSAGE_MAX } from '@vcraft/contracts';
import { foldVietnamese, isAllowedLink, maskPii, normalizeUserText } from '@vcraft/utils';
import type { KeyValueStore } from '../infrastructure/key-value';

/**
 * The assistant's guardrails (PLAN E15, ARCHITECTURE §7.6, NFR-SEC-09). Principle: block real attacks,
 * never block real users. Heuristics only raise suspicion; the classification model decides.
 */

export type BlockReason =
  | 'INJECTION'
  | 'ABUSE'
  | 'PRIVATE_DATA'
  | 'RATE_LIMITED'
  | 'BUDGET_EXHAUSTED'
  | 'DISABLED';

export interface GuardContext {
  message: string;
  /** 0–1: how much the text looks like an attempt to steer the model; passed to the classifier. */
  suspicion: number;
  ipHash: string;
  conversationId: string;
}

export type GuardResult = { ok: true } | { ok: false; reason: BlockReason; retryAfter?: number };

/** One link of the input-side chain (Chain of Responsibility). */
export interface Guard {
  check(ctx: GuardContext): Promise<GuardResult>;
}

// Folded (no accents, lower case) phrases that often appear in prompt injection, in vi and en.
const SUSPICIOUS = [
  /ignore (all |the )?(previous|above|prior) (instructions|prompts?|rules)/,
  /bo qua (moi |tat ca |cac )?(huong dan|chi dan|quy tac|lenh)/,
  /(system|developer) (prompt|message|mode)/,
  /prompt (he thong|goc)/,
  /\byou are now\b|\bpretend (to be|you are)\b|\bact as\b/,
  /\bjailbreak\b|\bdan mode\b|\bdo anything now\b/,
  /(tiet lo|in ra|cho (toi|minh|tao) xem) (prompt|huong dan|cau lenh)/,
  /<\/?(system|instructions?|assistant)>/,
];
const BASE64_RUN = /[A-Za-z0-9+/]{48,}={0,2}/;

/**
 * Canonical text plus a suspicion score. Nothing is rejected here except an empty or over-long message,
 * which the request schema already refuses.
 */
export function sanitizeInput(raw: string): { message: string; suspicion: number } {
  const message = normalizeUserText(raw).slice(0, ASSISTANT_MESSAGE_MAX);
  const folded = foldVietnamese(message);
  let suspicion = 0;
  for (const pattern of SUSPICIOUS) if (pattern.test(folded)) suspicion += 0.4;
  if (BASE64_RUN.test(message)) suspicion += 0.3;
  return { message, suspicion: Math.min(1, suspicion) };
}

/**
 * Reads an optional limit from the environment: a positive integer turns it on, anything else (unset,
 * empty, 0, negative, not a number) leaves it off. Returns 0 for "off".
 */
export function positiveInt(raw: string | undefined): number {
  const value = Number(raw?.trim());
  return Number.isInteger(value) && value > 0 ? value : 0;
}

/**
 * Optional rate limit per IP and per conversation (Redis counters). Off by default: a window with no
 * limit (undefined or 0) is never counted, and with neither window set the guard touches no counters.
 * Set `ASSISTANT_RATE_LIMIT_PER_MINUTE` and/or `ASSISTANT_RATE_LIMIT_PER_DAY` to turn it on.
 */
export class RateLimiter implements Guard {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly perMinute = 0,
    private readonly perDay = 0,
  ) {}

  /** Whether at least one window has a limit; when false `check` always passes. */
  get enabled(): boolean {
    return this.perMinute > 0 || this.perDay > 0;
  }

  async check(ctx: GuardContext): Promise<GuardResult> {
    if (!this.enabled) return { ok: true };
    for (const subject of [`ip:${ctx.ipHash}`, `conv:${ctx.conversationId}`]) {
      for (const [window, limit, ttl] of [
        ['m', this.perMinute, 60],
        ['d', this.perDay, 86_400],
      ] as const) {
        if (limit <= 0) continue;
        const key = `assistant:rl:${window}:${subject}`;
        if ((await this.kv.increment(key, ttl)) > limit)
          return { ok: false, reason: 'RATE_LIMITED', retryAfter: await this.kv.ttl(key) };
      }
    }
    return { ok: true };
  }
}

/**
 * Optional daily token ceiling across all visitors: a circuit breaker, after which "the Fox is asleep".
 * Off by default (`dailyTokens` of 0): nothing is blocked and no usage is recorded. Set
 * `ASSISTANT_DAILY_TOKENS` to a positive integer to turn it on.
 */
export class BudgetGuard implements Guard {
  constructor(
    private readonly kv: KeyValueStore,
    private readonly dailyTokens = 0,
    private readonly today: () => string = () => new Date().toISOString().slice(0, 10),
  ) {}

  get enabled(): boolean {
    return this.dailyTokens > 0;
  }

  private key() {
    return `assistant:budget:${this.today()}`;
  }

  async check(): Promise<GuardResult> {
    if (!this.enabled) return { ok: true };
    const used = Number((await this.kv.get(this.key())) ?? 0);
    return used >= this.dailyTokens ? { ok: false, reason: 'BUDGET_EXHAUSTED' } : { ok: true };
  }

  async record(tokens: number): Promise<void> {
    if (this.enabled && tokens > 0) await this.kv.increment(this.key(), 2 * 86_400, tokens);
  }
}

/** Runs the input guards in order and stops at the first that blocks. */
export class GuardrailPipeline {
  constructor(private readonly guards: readonly Guard[]) {}

  async run(ctx: GuardContext): Promise<GuardResult> {
    for (const guard of this.guards) {
      const result = await guard.check(ctx);
      if (!result.ok) return result;
    }
    return { ok: true };
  }
}

// Markdown images (never shown), raw HTML tags, and markdown links whose target is not allowed.
const IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const HTML_TAG = /<\/?[a-zA-Z][^>]*>/g;
// Whitespace inside the parentheses is tolerated: models often write `[text]( /path )`.
const LINK = /\[([^\]]+)\]\(\s*([^)\s]+)\s*\)/g;
const BARE_URL = /\bhttps?:\/\/[^\s)]+/g;

/** Cleans one stretch of model output: no images or HTML, only allowed links, PII masked. */
export function cleanOutput(text: string, allowedOrigins: readonly string[]): string {
  return maskPii(
    text
      .replace(IMAGE, '')
      .replace(HTML_TAG, '')
      .replace(LINK, (_, label: string, href: string) =>
        isAllowedLink(href, allowedOrigins) ? `[${label}](${href})` : label,
      )
      .replace(BARE_URL, (url) => (isAllowedLink(url, allowedOrigins) ? url : '')),
  );
}

/**
 * Output side of the pipeline for a streamed answer. It holds back the last stretch of text until a
 * line or sentence ends, so a link, a phone number or the canary split across chunks is still seen whole.
 * If the canary (a secret token planted in the system prompt) ever appears, the prompt is leaking: the
 * stream stops and the caller reports the answer as blocked.
 */
export class StreamingOutputFilter {
  private pending = '';
  leaked = false;

  constructor(
    private readonly canary: string,
    private readonly allowedOrigins: readonly string[],
  ) {}

  push(text: string): string {
    if (this.leaked) return '';
    this.pending += text;
    if (this.pending.includes(this.canary)) {
      this.leaked = true;
      this.pending = '';
      return '';
    }
    const cut = Math.max(
      this.pending.lastIndexOf('\n'),
      this.pending.lastIndexOf('. '),
      this.pending.lastIndexOf('? '),
      this.pending.lastIndexOf('! '),
    );
    // The canary is one alphanumeric token, so it can never straddle a flushed line or sentence end:
    // whatever is flushed was checked whole above.
    if (cut < 0) return '';
    const ready = this.pending.slice(0, cut + 1);
    this.pending = this.pending.slice(cut + 1);
    return cleanOutput(ready, this.allowedOrigins);
  }

  end(): string {
    if (this.leaked) return '';
    const rest = this.pending;
    this.pending = '';
    if (rest.includes(this.canary)) {
      this.leaked = true;
      return '';
    }
    return cleanOutput(rest, this.allowedOrigins);
  }
}
