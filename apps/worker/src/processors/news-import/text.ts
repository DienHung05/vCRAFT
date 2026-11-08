import type { FeedItem } from './feed';
import type { LlmMessage, NewsLlm } from './llm';

export interface StoryText {
  summary: string;
  body: string;
}

const clip = (text: string, max: number) =>
  text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}…`;

/**
 * Text used when no LLM is configured: the feed's own snippet, cut to one line. The full article is never
 * stored, only a pointer to the original.
 */
export function fallbackText(
  item: Pick<FeedItem, 'description' | 'title'>,
  publisher: string,
): StoryText {
  const line = clip(item.description || item.title, 220);
  return {
    summary: line,
    body: `${line}\n\nĐọc bài gốc trên ${publisher} qua liên kết ở phần nguồn.`,
  };
}

export function paraphrasePrompt(
  item: Pick<FeedItem, 'title' | 'description'>,
  publisher: string,
): LlmMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You write short news summaries for a Vietnamese craft-village website.',
        'Paraphrase the given headline and snippet in your own words, in Vietnamese. Do not copy sentences.',
        'Use only facts that appear in the snippet. Do not add details, quotes, numbers, names or dates that are not in it.',
        'Return JSON: {"summary": string up to 300 characters, "body": string of 2 short paragraphs, up to 900 characters}.',
      ].join('\n'),
    },
    {
      role: 'user',
      content: `Publisher: ${publisher}\nHeadline: ${item.title}\nSnippet: ${item.description}`,
    },
  ];
}

/** Paraphrased text from the LLM, or the fallback when there is no model or its answer is unusable. */
export async function storyText(
  llm: NewsLlm | null,
  item: Pick<FeedItem, 'title' | 'description'>,
  publisher: string,
): Promise<StoryText> {
  if (llm) {
    try {
      const parsed = JSON.parse(await llm.completeJson(paraphrasePrompt(item, publisher))) as {
        summary?: unknown;
        body?: unknown;
      };
      if (
        typeof parsed.summary === 'string' &&
        typeof parsed.body === 'string' &&
        parsed.summary.trim() &&
        parsed.body.trim()
      )
        return { summary: clip(parsed.summary.trim(), 500), body: parsed.body.trim() };
    } catch {
      // Falls back to the feed snippet below.
    }
  }
  return fallbackText(item, publisher);
}
