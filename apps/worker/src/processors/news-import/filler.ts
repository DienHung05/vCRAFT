import type { LlmMessage } from './llm';

/** Evergreen subjects of the filler: true, permanent craft knowledge, never events. */
export const FILLER_TOPICS = [
  {
    key: 'clay-preparation',
    title: 'How clay is prepared for pottery',
    photoQuery: 'Bát Tràng clay pottery workshop',
  },
  {
    key: 'glaze-types',
    title: 'Glaze types used on Vietnamese ceramics',
    photoQuery: 'Bát Tràng ceramic glaze',
  },
  {
    key: 'firing',
    title: 'Firing ceramics: from wood kilns to gas kilns',
    photoQuery: 'Bát Tràng kiln firing',
  },
  {
    key: 'ceramic-care',
    title: 'Caring for ceramics at home',
    photoQuery: 'Bát Tràng ceramic bowl',
  },
  {
    key: 'village-history',
    title: 'A short history of Bát Tràng pottery village',
    photoQuery: 'Bát Tràng village',
  },
  {
    key: 'visitor-guide',
    title: 'Visitor guide to the permanent places of Bát Tràng',
    photoQuery: 'Bát Tràng pottery market',
  },
] as const;
export type FillerTopic = (typeof FILLER_TOPICS)[number];

/** True when fewer than `threshold` stories went live in the last 30 days. */
export const needsFiller = (publishedLast30Days: number, threshold: number): boolean =>
  publishedLast30Days < threshold;

/** The constraints every generated article is held to; exported so tests can check the prompt carries them. */
export const FILLER_RULES = [
  'Write an evergreen explainer, not news. It must stay true next year.',
  'Do NOT invent events, dates, people, quotes, prices, orders or households. Do not name any specific person, workshop or household.',
  'Do not claim that anything happened recently and do not use phrases such as "this week", "recently" or "announced".',
  'Use only general, well-established knowledge about the craft. If you are unsure of a fact, leave it out.',
  'List the references the article is based on (published books, museum or encyclopaedia pages) in "references". Do not list a reference you are not sure exists.',
] as const;

export function buildFillerPrompt(topic: { title: string }): LlmMessage[] {
  return [
    {
      role: 'system',
      content: [
        'You write evergreen educational articles for a Vietnamese pottery-village website.',
        ...FILLER_RULES.map((rule, index) => `${index + 1}. ${rule}`),
        'Write in Vietnamese. Return JSON: {"title": string up to 120 characters, "summary": string up to 300 characters, "paragraphs": array of 4 to 6 strings, "references": array of at least 1 string}.',
      ].join('\n'),
    },
    { role: 'user', content: `Topic: ${topic.title}` },
  ];
}

export interface FillerArticle {
  title: string;
  summary: string;
  paragraphs: string[];
  references: string[];
}

/** Parse and validate the model's answer; `null` for anything that breaks the shape or lacks references. */
export function parseFillerArticle(raw: string): FillerArticle | null {
  try {
    const value = JSON.parse(raw) as Record<string, unknown>;
    const strings = (input: unknown) =>
      Array.isArray(input) && input.every((entry) => typeof entry === 'string' && entry.trim())
        ? (input as string[]).map((entry) => entry.trim())
        : null;
    const paragraphs = strings(value.paragraphs);
    const references = strings(value.references);
    if (
      typeof value.title !== 'string' ||
      !value.title.trim() ||
      typeof value.summary !== 'string' ||
      !value.summary.trim() ||
      !paragraphs ||
      paragraphs.length < 2 ||
      !references ||
      references.length < 1
    )
      return null;
    return {
      title: value.title.trim().slice(0, 200),
      summary: value.summary.trim().slice(0, 500),
      paragraphs,
      references,
    };
  } catch {
    return null;
  }
}

/** Plain text body of a generated article: the paragraphs, then the reference list. */
export function fillerBody(article: FillerArticle): string {
  return `${article.paragraphs.join('\n\n')}\n\nTài liệu tham khảo:\n${article.references.map((r) => `- ${r}`).join('\n')}`;
}
