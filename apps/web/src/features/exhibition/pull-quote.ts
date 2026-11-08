/**
 * A pull quote for the household page: the first sentence of a story paragraph, when it reads well on
 * its own (long enough to say something, short enough to quote). Null otherwise, so the page shows no
 * quote rather than a fragment.
 */
export function pullQuote(paragraph: string, min = 40, max = 200): string | null {
  const text = paragraph.trim().replace(/\s+/g, ' ');
  const match = text.match(/^.+?[.!?…](?=\s|$)/u);
  const sentence = (match?.[0] ?? text).trim();
  if (sentence.length < min || sentence.length > max) return null;
  return sentence.replace(/[.…]+$/u, '');
}
