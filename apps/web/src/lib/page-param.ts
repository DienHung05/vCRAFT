/**
 * `?page=N` from a URL: a whole number from 1 to 10,000, anything else is page 1. A page past the end is
 * not decided here: the API answers it with the last page (ADR-0020).
 */
export function parsePageParam(value: string | string[] | undefined): number {
  const raw = (Array.isArray(value) ? value[0] : value) ?? '';
  const page = /^\d{1,5}$/.test(raw) ? Number.parseInt(raw, 10) : 1;
  return page >= 1 && page <= 10_000 ? page : 1;
}
