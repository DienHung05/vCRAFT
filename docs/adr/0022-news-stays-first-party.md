# ADR-0022: News stays first-party, with no automatic intake of external news

**Status:** Accepted
**Date:** 2026-11-07
**Deciders:** Project owner
**Tracks:** GH#192 (follows GH#181)

## Context

The news section shows stories from the village administration and from each household. GH#181 asked
for real, matching cover photos and for the section to keep itself up to date. One way to keep it fresh
would be to pull articles automatically from outside sources (press sites, the commune portal, RSS
feeds).

Automatic intake would need a licence for each source's text and photos, and a person to check that each
photo really shows what the story is about. Without those checks, the section could show the wrong or
fake images that GH#181 set out to remove.

## Decision

- News is **first-party only**. The village administration writes the stories in the admin console
  (`/admin/tin-tuc`), both village news and news about a household. New stories appear on `/tin-tuc`,
  the household page and the home page as soon as they are published, so the section stays current
  without outside sources.
- **No automatic intake of external news** in this release: no scraping, RSS import or scheduled fetch.
- A story may link to an outside article. Its cover must be a photo the author owns, or one with a known
  open licence that is recorded in the photo manifest and listed on `/ghi-nhan-anh`.
- Product photos with an unknown licence are handled in GH#204, which audits every product photo.

## Options considered

- **RSS or scheduled import from press and commune sites.** Rejected for now: licensing is unclear for
  each source, and photos can't be matched without a person checking them.
- **Import into a moderation queue that an administrator approves.** Could be revisited after the
  release if a source with clear licensing turns up. It would reuse the admin console and the photo
  manifest rules.

## Consequences

- The news section depends on the administration posting regularly. Demo data gives it 18 stories to
  start with.
- There are no third-party content licences to track, beyond the photos already listed on
  `/ghi-nhan-anh`.
