import { describe, expect, it } from 'vitest';
import { messages } from '../src';

type Tree = { [key: string]: string | Tree };

/** Duỗi cây từ điển thành `đường.dẫn → chuỗi`. */
function flatten(tree: Tree, prefix = ''): Map<string, string> {
  const out = new Map<string, string>();
  for (const [key, value] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') out.set(path, value);
    else for (const [p, v] of flatten(value, path)) out.set(p, v);
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
    const properNouns = /Bát Tràng/g;
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
