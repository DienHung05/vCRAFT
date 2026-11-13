// @vitest-environment node
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { isCoveredBy, PUBLIC_MESSAGE_PATHS, pickMessages } from '@/lib/public-messages';
import en from '../../../packages/i18n/messages/en.json';
import vi from '../../../packages/i18n/messages/vi.json';

const SRC = fileURLToPath(new URL('../src', import.meta.url));
const LOCALE_DIR = path.join(SRC, 'app/[locale]');

function listSources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

const sources = new Map(listSources(SRC).map((file) => [file, readFileSync(file, 'utf8')]));

function resolveImport(from: string, spec: string): string | undefined {
  let base: string;
  if (spec.startsWith('@/')) base = path.join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(from), spec);
  else return undefined;
  return [base, `${base}.ts`, `${base}.tsx`, `${base}/index.ts`, `${base}/index.tsx`].find((c) =>
    sources.has(c),
  );
}

function importsOf(file: string): string[] {
  const code = sources.get(file) ?? '';
  return [...code.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)].flatMap((m) => {
    const resolved = resolveImport(file, m[1] as string);
    return resolved ? [resolved] : [];
  });
}

function closure(starts: Iterable<string>): Set<string> {
  const seen = new Set<string>();
  const stack = [...starts];
  while (stack.length > 0) {
    const file = stack.pop() as string;
    if (seen.has(file)) continue;
    seen.add(file);
    stack.push(...importsOf(file));
  }
  return seen;
}

/** Every file a public route (or the shell, error and not-found pages) can render. */
const PUBLIC_ROOTS = [...sources.keys()].filter(
  (file) =>
    ['(discover)', '(marketing)', 'truy-xuat', '[...rest]'].some((dir) =>
      file.startsWith(path.join(LOCALE_DIR, dir)),
    ) ||
    file.startsWith(path.join(SRC, 'components/shell')) ||
    path.dirname(file) === LOCALE_DIR,
);

const USE_CLIENT = /^\s*(?:\/\/.*\n|\/\*[\s\S]*?\*\/\s*)*['"]use client['"]/;

/** Namespaces read with `useTranslations('...')` by code that ships to the browser from a public route. */
function clientNamespaces(): Map<string, string[]> {
  const clientRoots = [...closure(PUBLIC_ROOTS)].filter((f) =>
    USE_CLIENT.test(sources.get(f) ?? ''),
  );
  const used = new Map<string, string[]>();
  for (const file of closure(clientRoots)) {
    for (const m of (sources.get(file) ?? '').matchAll(
      /useTranslations\(\s*(['"][^'"]*['"])?\s*\)/g,
    )) {
      const ns = m[1]?.slice(1, -1) ?? '';
      used.set(ns, [...(used.get(ns) ?? []), path.relative(SRC, file)]);
    }
  }
  return used;
}

describe('public message subset', () => {
  it('covers every namespace a client component of a public route reads', () => {
    const missing = [...clientNamespaces()].filter(
      ([ns]) => ns === '' || !isCoveredBy(ns, PUBLIC_MESSAGE_PATHS),
    );
    expect(missing).toEqual([]);
  });

  it('only lists paths that exist in both dictionaries', () => {
    for (const messages of [vi, en]) {
      const picked = pickMessages(messages, PUBLIC_MESSAGE_PATHS);
      for (const entry of PUBLIC_MESSAGE_PATHS) {
        expect(pickMessages(picked, [entry]), entry).not.toEqual({});
      }
    }
  });

  it('is much smaller than the full dictionary', () => {
    const full = JSON.stringify(vi).length;
    const subset = JSON.stringify(pickMessages(vi, PUBLIC_MESSAGE_PATHS)).length;
    expect(subset).toBeLessThan(full * 0.6);
  });

  it('pickMessages keeps nested paths and drops the rest', () => {
    const tree = { a: { b: { c: 'x', d: 'y' }, e: 'z' }, f: 'w' };
    expect(pickMessages(tree, ['a.b', 'f', 'missing'])).toEqual({
      a: { b: { c: 'x', d: 'y' } },
      f: 'w',
    });
    expect(pickMessages(tree, ['a.b.c', 'a.e'])).toEqual({ a: { b: { c: 'x' }, e: 'z' } });
  });
});
