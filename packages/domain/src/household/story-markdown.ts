/**
 * The household story is stored as a restricted Markdown subset (FR-ART-01): paragraphs, `**bold**`,
 * `*italic*`, `[text](https://…)` links and `- ` bullet lists. Anything else is plain text, so a legacy
 * plain-text story renders as it always did, and nothing in the text is ever treated as HTML: callers
 * render the parsed nodes as React elements (never `innerHTML`).
 */
export type StoryInline =
  | { type: 'text'; text: string }
  | { type: 'strong'; children: StoryInline[] }
  | { type: 'em'; children: StoryInline[] }
  | { type: 'link'; href: string; children: StoryInline[] };

export type StoryBlock =
  | { type: 'paragraph'; children: StoryInline[] }
  | { type: 'list'; items: StoryInline[][] };

/** Link schemes a story may use; `javascript:`, `data:` and the like stay plain text. */
const SAFE_HREF = /^(?:https?:\/\/|mailto:)[^\s<>"']+$/i;
export const isSafeStoryHref = (href: string) => SAFE_HREF.test(href);

const INLINE =
  /\*\*(?=\S)([^*]+?)(?<=\S)\*\*|(?<![*\w])\*(?=[^\s*])([^*]+?)(?<=[^\s*])\*(?![*\w])|\[([^\]\n]+)\]\(([^)\s]+)\)/g;

export function parseStoryInline(text: string, depth = 0): StoryInline[] {
  const nodes: StoryInline[] = [];
  let last = 0;
  const push = (value: string) => {
    if (value) nodes.push({ type: 'text', text: value });
  };
  for (const match of text.matchAll(INLINE)) {
    const [whole, bold, italic, label, href] = match;
    const index = match.index ?? 0;
    // A link with an unsafe address stays literal text.
    if (label !== undefined && !isSafeStoryHref(href ?? '')) continue;
    push(text.slice(last, index));
    const nest = (inner: string) =>
      depth < 3 ? parseStoryInline(inner, depth + 1) : [textNode(inner)];
    if (bold !== undefined) nodes.push({ type: 'strong', children: nest(bold) });
    else if (italic !== undefined) nodes.push({ type: 'em', children: nest(italic) });
    else nodes.push({ type: 'link', href: href ?? '', children: [textNode(label ?? '')] });
    last = index + whole.length;
  }
  push(text.slice(last));
  return nodes;
}

const textNode = (text: string): StoryInline => ({ type: 'text', text });
const BULLET = /^[-*]\s+(.*)$/;

/** Blocks of the story: blank lines separate them, consecutive `- ` lines form one list. */
export function parseStoryMarkdown(source: string): StoryBlock[] {
  const blocks: StoryBlock[] = [];
  for (const chunk of source.replace(/\r\n?/g, '\n').split(/\n{2,}/)) {
    let paragraph: string[] = [];
    let list: StoryInline[][] = [];
    const flushParagraph = () => {
      const text = paragraph.join('\n').trim();
      if (text) blocks.push({ type: 'paragraph', children: parseStoryInline(text) });
      paragraph = [];
    };
    const flushList = () => {
      if (list.length > 0) blocks.push({ type: 'list', items: list });
      list = [];
    };
    for (const line of chunk.split('\n')) {
      const bullet = BULLET.exec(line.trim());
      if (bullet) {
        flushParagraph();
        list.push(parseStoryInline(bullet[1] ?? ''));
      } else {
        flushList();
        paragraph.push(line);
      }
    }
    flushParagraph();
    flushList();
  }
  return blocks;
}

const inlineText = (nodes: readonly StoryInline[]): string =>
  nodes.map((node) => (node.type === 'text' ? node.text : inlineText(node.children))).join('');

/** The story without its markup: for meta descriptions, JSON-LD and plain summaries. */
export function storyPlainText(source: string): string {
  return parseStoryMarkdown(source)
    .map((block) =>
      block.type === 'paragraph'
        ? inlineText(block.children)
        : block.items.map(inlineText).join('\n'),
    )
    .join('\n\n');
}
