/** Pure text edits behind the story toolbar: each returns the new text and the selection to restore. */
export interface TextEdit {
  value: string;
  start: number;
  end: number;
}

/**
 * Wraps the selection in `marker` (`**` bold, `*` italic), or removes the marker when the selection is
 * already wrapped. With nothing selected it inserts the marker around `placeholder` and selects that.
 */
export function toggleWrap(
  value: string,
  start: number,
  end: number,
  marker: string,
  placeholder: string,
): TextEdit {
  const len = marker.length;
  const before = value.slice(start - len, start);
  const after = value.slice(end, end + len);
  // A lone `*` next to another `*` belongs to bold, not italic.
  const isBoldEdge = marker === '*' && (value[start - len - 1] === '*' || value[end + len] === '*');
  if (start !== end && before === marker && after === marker && !isBoldEdge) {
    return {
      value: value.slice(0, start - len) + value.slice(start, end) + value.slice(end + len),
      start: start - len,
      end: end - len,
    };
  }
  const text = start === end ? placeholder : value.slice(start, end);
  return {
    value: value.slice(0, start) + marker + text + marker + value.slice(end),
    start: start + len,
    end: start + len + text.length,
  };
}

const BULLET = /^- /;

/** Turns every line touched by the selection into a `- ` bullet, or back into plain lines if all already are. */
export function toggleBullets(value: string, start: number, end: number): TextEdit {
  const from = value.lastIndexOf('\n', start - 1) + 1;
  const lineEnd = value.indexOf('\n', end);
  const to = lineEnd === -1 ? value.length : lineEnd;
  const lines = value.slice(from, to).split('\n');
  const allBullets = lines.every((line) => BULLET.test(line));
  const block = lines
    .map((line) => (allBullets ? line.replace(BULLET, '') : BULLET.test(line) ? line : `- ${line}`))
    .join('\n');
  return {
    value: value.slice(0, from) + block + value.slice(to),
    start: from,
    end: from + block.length,
  };
}

/** Link schemes the story accepts; mirrors the renderer in `@vcraft/domain`. */
export const isAllowedLinkUrl = (url: string) => /^(?:https?:\/\/|mailto:)[^\s<>"')]+$/i.test(url);

/** Replaces the selection with `[selection](url)`, or `[fallback](url)` when nothing is selected. */
export function insertLink(
  value: string,
  start: number,
  end: number,
  url: string,
  fallback: string,
): TextEdit {
  const text = start === end ? fallback : value.slice(start, end);
  const link = `[${text.replace(/[[\]]/g, '')}](${url})`;
  return {
    value: value.slice(0, start) + link + value.slice(end),
    start,
    end: start + link.length,
  };
}
