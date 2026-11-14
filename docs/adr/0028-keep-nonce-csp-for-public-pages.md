# ADR-0028: Keep the nonce-based CSP on public pages, and stop streaming the first catalog page

**Status:** Accepted
**Date:** 2026-11-14
**Deciders:** Project maintainer
**Tracks:** GH#529 (mobile LCP of `/vi/san-pham`). Builds on ADR-0027.

## Context

Mobile Lighthouse on the product list scores Performance 84 to 90 with an LCP of 3.0 to 4.3 s; the target
is 2.5 s or less. The LCP element is the cover of a first-row product card (already `fetchpriority="high"`,
about 10 KB of AVIF). The browser only finds it when the streamed grid chunk arrives: the route had a
`loading.tsx` and the page awaits two API reads, so the document flushed a skeleton first and the real
cards came later in a hidden `<div hidden id="S:...">` chunk that React swaps in.

Every public page is dynamic because the root layout reads the CSP nonce (`lib/csp.ts`, `proxy.ts`), so
"make the page static" is the obvious idea. The exhibition reads themselves are already in the Next Data
Cache (ADR-0027: `revalidate: 60` plus tags), so the cost left is the streaming shape, not the API.

## Decision

1. **Keep the nonce-based CSP** (`'nonce-...'` plus `'strict-dynamic'`, no `'unsafe-inline'` for scripts)
   unchanged. Public pages stay dynamic.
2. **Do not stream the first catalog page.** Remove
   `app/[locale]/(discover)/san-pham/(list)/loading.tsx`. Without a loading boundary the document waits
   for the (cached) reads and ships the grid, including the first cards' `<img>` tags, in the initial
   HTML.
3. **Preload the first two covers.** The page calls `ReactDOM.preload` (`preloadCardCovers`) with the same
   URL, `srcset` and `sizes` the card renders, so the browser fetches them from the `<head>`.

## Options considered

- **Static pages plus Next's experimental SRI (`experimental.sri`).** SRI adds `integrity` to the external
  chunk files only (checked in Next 16.4.3: `required-scripts` takes hashes from the SRI manifest; the
  Next docs list "cannot handle dynamically generated scripts" as a limit). Next still emits per-page
  inline scripts, the RSC flight payloads `self.__next_f.push(...)`. Without a nonce they would need
  `'unsafe-inline'`, which is weaker than today's nonce plus `strict-dynamic` (NFR-SEC-04, GH#240).
  Rejected.
- **Hash-only CSP for our own constant bootstrap scripts.** Does not help for the same reason: the flight
  payloads differ per page and per request, so their hashes cannot be known ahead of time. Rejected.
- **Nonce on some routes only.** The nonce is set by the proxy and read by the root layout; splitting it by
  route would give the catalog a weaker policy than the rest and still leave the flight scripts to cover.
  Rejected.
- **Keep the nonce and stop streaming the first page (chosen).** Costs a wait for the cached reads but
  needs no change to the security model.

## Consequences

- Every public page stays dynamic; there is no CDN caching of HTML.
- The first catalog page now waits for its cached reads before the first byte of the grid. On a warm Data
  Cache that is small. On a cold cache TTFB grows by the API time, where a skeleton used to show first.
- On client navigation to `/san-pham` the previous page stays on screen until the new one is ready (Next's
  default). No parent `loading.tsx` covers this route (`(discover)` and `[locale]` have none), so streaming
  does not come back through a parent boundary; do not add one without revisiting this ADR.
- The preload skips cards that have no API variants (demo photos, drawn stand-ins).
- The LCP effect was not measured here: it needs Lighthouse against the deployed site.
