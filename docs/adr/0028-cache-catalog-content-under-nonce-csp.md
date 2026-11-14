# ADR-0028: Cache catalog reads and send the grid inside the nonce-protected document

**Status:** Accepted
**Date:** 2026-11-14
**Tracks:** GH#529. Extends ADR-0016 and ADR-0027.

## Context

The mobile catalog LCP is a first-row product cover. The image is small and already has high fetch
priority, but the list route's `loading.tsx` lets Next send a skeleton before discovering the image.
The root locale layout reads the request's CSP nonce, so the document renders on every request.
The catalog also explicitly forced dynamic rendering, which disables its tagged fetch cache even
though ADR-0027 configured those reads to be cached.

The current script policy uses a fresh 128-bit nonce and `strict-dynamic`, without `unsafe-inline` or
production `unsafe-eval`. A static HTML document cannot contain a fresh request nonce. Next's
partial prerendering has the same limitation. Hashing the three constant bootstrap scripts alone
would not authorize Next's inline Flight payloads and streaming instructions. Those depend on the
rendered content. Subresource integrity for external bundles does not authorize these inline scripts.

## Decision

1. Keep the existing per-request nonce policy and root layout. The security posture remains unchanged.
   Do not enable `cacheComponents` or partial prerendering, reuse a build-time nonce, or add
   `unsafe-inline` to make cached documents execute.
2. Remove the catalog's `dynamic = 'force-dynamic'`. The root layout's nonce read still makes the
   document dynamic, while explicit `next: { revalidate: 60, tags: ['exhibition'] }` fetches can use
   the Data Cache again. Anonymous first-page, filtered, and numbered catalog reads all retain the
   existing worker invalidation from ADR-0027. No personalized reads enter this cache.
3. Remove the list route's `loading.tsx` boundary. Resolve the catalog before returning the page so
   its image tags are in the initial document instead of hidden in a streamed replacement after a
   skeleton. Preserve client filtering, numbered pages, browser history, and retry states.

## Options considered

- **Hash-based CSP for static public documents.** A complete solution must hash every inline framework
  payload for every rendered variant, update the matching response policy atomically during
  revalidation, and authorize parser-inserted external bundles under `strict-dynamic`. The current
  Next/Vercel deployment does not provide that response transformation. Hashing just our constant
  scripts or enabling bundle SRI would leave hydration blocked. Rejected for this change.
- **`"use cache"` only on the catalog.** In Next 16.4, `experimental.useCache` is a deprecated alias
  for cache-components behavior, not an independent component cache. A production build rejects
  existing route segment configuration when it is enabled. Migrating the app to partial prerendering
  would also conflict with fresh document nonces. Rejected.
- **Nonce only on authenticated routes.** Public routes still hydrate, accept public content, load
  the map, and expose sign-in links. Allowing inline scripts there would weaken the existing policy.
  Rejected.
- **Cache HTML with a shared nonce.** That turns the nonce into a reusable script authorization token.
  Rejected.
- **Keep streaming and preload the first image separately.** A second catalog read would have to
  reproduce the active filters and responsive image choice. It would also leave the grid outside
  the initial document. Rejected.

## Consequences

The outer document still renders per request and remains private and uncacheable at the CDN. This
change restores cached catalog data rather than claiming to statically generate the whole page.
Full static rendering remains outside this implementation. Other public and authenticated routes
keep their existing CSP and rendering behavior.

A cold visit waits for catalog data before receiving the page. Warm visits reuse the tagged API
responses, avoiding the API round trips that `force-dynamic` previously required on every visit.
The worker's existing `exhibition` invalidation expires those responses after edits, withdrawals,
household suspension, or media readiness. The 60-second TTL and the detail-404 limitations of
ADR-0027 remain unchanged.

Measure mobile Lighthouse on the deployed build, with three runs per target route, before claiming
the LCP and Performance acceptance criteria. A successful build or a fast local response alone does
not establish those production numbers.
