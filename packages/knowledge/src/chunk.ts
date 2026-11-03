/**
 * About 500 tokens per chunk (PLAN E15). Vietnamese runs near 4 characters per token in the OpenAI
 * tokenizer, so chunks aim at 2,000 characters, with a short overlap so an answer split across a boundary
 * is still found.
 */
export const CHUNK_CHARS = 2_000;
export const CHUNK_OVERLAP = 200;

/**
 * Splits text into chunks of at most `max` characters, cutting at paragraph, then sentence, then word
 * boundaries, and repeating up to `overlap` characters of the previous chunk at the start of the next.
 */
export function chunkText(text: string, max = CHUNK_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  if (clean.length <= max) return [clean];
  const chunks: string[] = [];
  let start = 0;
  while (start < clean.length) {
    let end = Math.min(clean.length, start + max);
    if (end < clean.length) {
      const window = clean.slice(start, end);
      const cut = Math.max(
        window.lastIndexOf('\n\n'),
        window.lastIndexOf('. '),
        window.lastIndexOf('? '),
        window.lastIndexOf('! '),
      );
      const space = window.lastIndexOf(' ');
      // Prefer a paragraph or sentence end in the second half, else a word boundary, else a hard cut.
      if (cut > max / 2) end = start + cut + 1;
      else if (space > max / 2) end = start + space;
    }
    chunks.push(clean.slice(start, end).trim());
    if (end >= clean.length) break;
    const next = end - overlap;
    // Restart the overlap at a word boundary.
    const boundary = clean.indexOf(' ', next);
    start = boundary > next && boundary < end ? boundary + 1 : Math.max(next, start + 1);
  }
  return chunks.filter(Boolean);
}
