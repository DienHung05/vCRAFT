# GH#301 public pages audit: dead space and motion

Method: a code audit (page components, container widths, section paddings, grid columns). No browser was
available, so there are no screenshots or Lighthouse numbers; the 1440 px and 390 px checks in the issue
still need a manual pass. Status: **done** = implemented in this change, **open** = proposed only.

## Shared changes

| Area | Finding | Change | Status |
| --- | --- | --- | --- |
| Section rhythm | `--spacing-section` runs 4 to 10 rem. Short blocks (list pages, a row of cards) left up to 10 rem of empty space above or below. | New `--spacing-block` token (2.5 to 5 rem, `pt-block`, `pb-block`, `py-block`) for short blocks. `section` stays for large, image-led sections. | done |
| Scroll reveal | Motion was limited to the home page. | `experience/motion/reveal.tsx` (`Reveal`, `staggerDelay`) plus `.reveal` in `globals.css`: IntersectionObserver, opacity and transform only, below-the-fold blocks only, off under reduced motion, visible without IntersectionObserver. Wraps only leaves, so pages stay server components. | done |
| Hover lift | Product and household cards already lift with `group-hover:-translate-y-1`; news cards did not. | News cards lift (transform only, `motion-safe`). | done |

## Per page

| Page | Dead space found in code | Proposed change | Status |
| --- | --- | --- | --- |
| Home | Deliberately airy editorial sections (`py-section`), already carrying ink-reveal, day story and count-up. | Leave as is; it is the motion reference for the other pages. | open (kept) |
| Product list | `pb-section` (up to 10 rem) under the grid; grid items appeared all at once. | `pb-block`; staggered `Reveal` on grid items; loading skeleton uses the same padding so it does not jump. | done |
| Product detail | Gallery column is already sticky (`md:sticky`) beside the info column; "more from this household" already fetched but had `pt-section` and no bottom padding. | `pt-block` and `pb-block`; `Reveal` and staggered cards on the "more" section. Journey card untouched (other work). | done |
| Artisan list | 3 columns at 1440 px inside a 90 rem container (large covers); `pb-section`. | 4 columns at `lg`, `pb-block`, staggered `Reveal`, `sizes` updated. | done |
| Household page | `py-section` around the bento (10 rem top and bottom), `pb-section` and `pt-section` between every block; right-hand cell of the bento often empty when a household has no lineage or certifications; no numbers or quote from the story. | `py-block` and `pt-block` rhythm; `Reveal` on every section and staggered product cards; count-up stats strip from real counts (products, makers, certifications) when at least two exist; pull quote from the second story paragraph (`pullQuote`, null when no clean sentence). Story and gallery side by side at 1024 px: not done, the masonry gallery needs the full width and the story card already floats the portrait. | done (side by side open) |
| Map | `pb-section` under the explorer. | `pb-block`. | done |
| News list | Two columns at `md`, one narrow card per row look at 1440 px; `pb-section`. | Three columns at `lg` (two at `md`), staggered `Reveal`, card hover lift, `pb-block`. | done |
| News detail | Single `max-w-prose-vn` column with empty sides on wide screens; `pb-section`. | `pb-block`. A side column (more news, share) needs data not fetched on this page. | done (padding), side column open |
| Quote request | Form is a single `max-w-prose-vn` column. | Not changed: a form should stay narrow. A side summary (what happens next) would be new copy. | open |
| Trace page | FireStory is being changed by other work. | Not touched. | open |
| Login and sign-up | Kiln auth shell uses `--spacing-section` for its own overlap (`kiln.css`). | Not touched; changing the token there would shift the shell. | open |
| Privacy and photo credits | `ghi-nhan-anh` used `pb-section`. | `pb-block`. | done |

## Not done

- Lighthouse performance and CLS numbers, and before and after screenshots at 1440 px and 390 px.
- Real-browser check of horizontal scroll at 360 px (the changes only add grid columns at `lg` and
  transform-only motion, but this is unverified).
- Items marked open above.
