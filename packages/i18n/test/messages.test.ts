import { describe, expect, it } from 'vitest';
import { messages } from '../src';

// A list (the assistant's thought lines, quick questions) flattens to `key.0`, `key.1`, ….
type Tree = { [key: string]: string | Tree | readonly string[] };

/** Duỗi cây từ điển thành `đường.dẫn → chuỗi`. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [p, v] of flatten(value as Tree, path)) out.set(p, v);
  }
  return out;
}

/** Tên biến ICU (`{name}`, `{n, plural, …}`) và thẻ rich (`<link>`) trong một chuỗi. */
function placeholders(message: string): string[] {
  const vars = new Set<string>();
  for (const m of message.matchAll(/\{\s*([A-Za-z_][\w]*)\s*[,}]/g)) vars.add(`{${m[1]}}`);
  for (const m of message.matchAll(/<([A-Za-z][\w]*)>/g)) vars.add(`<${m[1]}>`);
  return [...vars].sort();
}

const vi = flatten(messages.vi as Tree);
const en = flatten(messages.en as Tree);

describe('từ điển vi/en', () => {
  it('cùng cấu trúc khóa', () => {
    expect([...en.keys()].sort()).toEqual([...vi.keys()].sort());
  });

  it('không có chuỗi rỗng', () => {
    for (const [path, text] of [...vi, ...en]) expect(text.trim(), path).not.toBe('');
  });

  it('cùng tập biến ICU và thẻ rich ở mọi khóa', () => {
    for (const [path, text] of vi) {
      expect(placeholders(en.get(path) ?? ''), path).toEqual(placeholders(text));
    }
  });

  it('bản en không còn chữ tiếng Việt (trừ tên riêng và tên ngôn ngữ)', () => {
    // Letters that exist only in Vietnamese orthography (no plain Latin/French/etc. overlap).
    const vietnamese = /[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/i;
    // Proper nouns and the name of the Vietnamese language keep their spelling in English text.
    const allowed = ['nav.switchTo'];
    const properNouns = /Bát Tràng|Gia Lâm/g;
    for (const [path, text] of en) {
      if (allowed.includes(path)) continue;
      expect(vietnamese.test(text.replace(properNouns, '')), `${path}: ${text}`).toBe(false);
    }
  });

  it('có đủ khóa trạng thái RFQ cho mọi trạng thái của domain', () => {
    for (const status of [
      'DRAFT',
      'SENT',
      'BIDDING',
      'ACCEPTED',
      'IN_PRODUCTION',
      'DELIVERED',
      'CANCELLED',
      'EXPIRED',
    ]) {
      expect(vi.has(`rfq.status.${status}`), status).toBe(true);
    }
  });
});

/** Wording that tells visitors the site is sample or demo data (GH#314). Real limits are worded without it. */
const BANNED_VISITOR_WORDS =
  /dữ liệu mẫu|tin mẫu|bản trình diễn|minh h[oọ]a|minh hoạ|mô phỏng|sample data|demo|illustrative/i;

/**
 * Demo payment mode (ADR-0025) is the one place that must say "demo": the live site rehearses payments and tells
 * the buyer so, on every screen of it. These keys are allowed to; nothing else is.
 */
const DEMO_PAYMENT_KEYS =
  /^payments\.(demo\.|demoConfirm\.|pay\.demoNote$|pay\.demoHint$|pay\.startDemo$|live\.waitingDemo$)/;

describe('visitor-facing wording', () => {
  it.each([
    ['vi', vi],
    ['en', en],
  ] as const)('%s strings never say sample, demo or illustrative data', (_locale, strings) => {
    const offenders = [...strings].filter(
      ([key, text]) => BANNED_VISITOR_WORDS.test(text) && !DEMO_PAYMENT_KEYS.test(key),
    );
    expect(offenders.map(([key]) => key)).toEqual([]);
  });
});
