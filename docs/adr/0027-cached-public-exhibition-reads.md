# ADR-0027: Public exhibition reads are cached, and dropped on demand when the data changes

**Status:** Accepted
**Date:** 2026-11-11
**Deciders:** Project maintainer
**Tracks:** GH#481 (mobile Lighthouse). Supersedes the `no-store` rule of vCRAFT-8my.1.

## Context

vCRAFT-8my.1 made every exhibition read of the web (products, product detail, households, household
detail, trace) use `cache: 'no-store'`, so a suspension or a withdrawal showed on the very next request.
The reason: Next keeps a stale `200` in its Data Cache when the API later answers `404`, so a cached
detail read could show a withdrawn item for ever.

The price is speed. On `/vi/san-pham` two uncached API reads hold the streamed document for about 2 s, and
the mobile LCP is about 6.6 s locally (GH#481). These pages are anonymous and the same for every visitor,
so a cache is the right tool, as long as a moderation decision still shows at once.

## Decision

1. **Cache the reads, with tags and a short TTL.** The exhibition reads in
   `apps/web/src/features/catalog/exhibition-api.ts` use the Next Data Cache with
   `next: { revalidate: 60, tags }` (`fetchPublicJson` takes the tags). Every read carries the broad tag
   `exhibition`; details also carry `household:<slug>`, `product:<slug>` or `trace:<CODE>`. The slug
   redirect, village stats and map-pin reads keep their 30 s TTL and carry `exhibition`. The shared tag
   shapes live in `@vcraft/utils` (`exhibition-tags`). The existing stale-schema guard of
   `fetchPublicJson` stays. News articles stay uncached (GH#395).
2. **Drop tags on demand.** `POST /api/revalidate` on the web (Node runtime) needs
   `Authorization: Bearer <REVALIDATE_SECRET>` (constant-time compare; `401` otherwise; `503` while the
   secret is unset), takes `{ tags: string[] }` (1 to 50 tags, each `exhibition`, `household:<slug>`,
   `product:<slug>` or `trace:<CODE>`; `400` otherwise) and calls `revalidateTag(tag, { expire: 0 })` for
   each, so a stale copy is never served and a `404` is read fresh on the next request. The secret is
   never logged.
3. **The API notifies through the outbox.** A change that alters public visibility or content writes an
   `exhibition.changed` `OutboxEvent` (payload `{ tags }`, `queueExhibitionChange`) in the same
   transaction. The worker's outbox relay delivers it to `WEB_REVALIDATE_URL` with `REVALIDATE_SECRET`
   and uses the outbox's existing retry (up to 5 attempts, exponential back-off; then `FAILED`, which the
   existing failed-event count surfaces). Events are written for: household approve, reject, suspend and
   reinstate; profile, slug, certification, workshop and artisan changes; product edit (including slug
   change), publish, withdraw, mark sold and back on sale; product makers; journal entries (trace and
   product tags only); a public photo turning `READY`; account deletion that scrubs a household. Changes
   that can alter a list card, a visibility or a map pin send `exhibition`; entry-level ones send the
   entity tags only. A slug change sends the old and the new slug.
4. **Unset means off.** Without `WEB_REVALIDATE_URL` and `REVALIDATE_SECRET` the worker sends nothing and
   completes the event (dev, test, a deploy not yet set up). The 60 s TTL then bounds staleness.

## Options considered

- **Keep `no-store`.** Correct, but it costs about 2 s of LCP on the busiest page and every visit hits
  the API. Rejected for the performance target.
- **TTL only, no on-demand call.** Simple, but a suspended household would stay visible up to 60 s, and a
  withdrawn item (a `404`) would stay visible indefinitely, because Next does not replace a stored `200`
  with a `404`. Rejected.
- **API calls the web directly after commit (fire and forget).** Fewer parts, but a lost call is lost, and
  it can fire before the commit is visible. The outbox already gives same-transaction writes and retries.
  Rejected.
- **A new queue and processor for the web call.** More code than the relay's own retry needs. Rejected.

## Consequences

- Pages get a warm Data Cache hit; the first request after a purge or a deploy pays the API read.
- A suspension, withdrawal or edit shows on the next request after the worker delivers the event (the relay
  runs every 2 s). If delivery fails for good (five attempts), a changed page stays stale for up to 60 s,
  **except** a detail whose item was retired (API `404`): Next keeps the old `200`, so that page may stay
  visible until the tag is revalidated again. A `FAILED` `exhibition.changed` event therefore needs a
  person: fix the cause, then re-run the call with the `exhibition` tag (see `docs/operations/deploy.md`).
- The trace page shows the scan count read at cache time, so it can lag by at most 60 s. A scan is
  recorded by `POST /trace/{code}/scan` from `/q/<code>`, never by the cached `GET`, so no scan is lost.
- A photo turning `READY` purges the broad tag (it cannot tell which page links it), once per upload.
- Behind the Caddy setup (`infra/caddy`), `/api/*` goes to the API, so `WEB_REVALIDATE_URL` must point at
  the web's own address there (for example `http://web:3000/api/revalidate`), not at the public domain.
- Nothing personalised or signed-in goes through these reads: they send no cookies or auth headers.
