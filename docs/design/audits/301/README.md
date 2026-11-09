# Public page spacing and motion, GH#301

The [audit posted before implementation](https://github.com/DienHung05/vCRAFT/issues/301#issuecomment-6721583661) covers all twelve public page types. The starting production baseline is `6d7bcf92`. Both versions read the same deployed public API. No records were created or changed.

The original audit used the development server. The final comparison screenshots use separate production servers. The capture utility now resets its viewport before each route so the 360-pixel overflow probe cannot affect the next 390-pixel screenshot. Both sets were refreshed after that correction.

## Changes by page

| Page | Audit finding and implemented response |
| --- | --- |
| Home | Reduced the final section spacing and added shared reveals to the later artisan and news sections. Kept the existing hero composition. |
| Product list | Increased desktop card gaps to 32 pixels and gave individual cards bounded staggered entrances. Preserved filtering and pagination. |
| Product detail | Kept the existing sticky photograph and related products. Added the labeled seven-stage journey summary and reveals around the journal and related products. |
| Artisan list | Kept the three-column portrait grid, added individual staggered entrances, and made hover lift respect reduced motion. |
| Household | Reduced the final page spacing and added a reveal around the story and certification group. Kept the existing exhibition and gallery. |
| Map | Reduced the final spacing and added a reveal around the existing filters, map and household list. Kept their flex spacing and mobile behavior. |
| News list | Changed the desktop list to two columns, kept one column on phones, and added individual reveals and transform-only hover lift. |
| News article | Kept the readable article width. Added a reveal to the real cover photograph and reduced the final spacing. |
| Quote request | The form lives at `/vi/yeu-cau-bao-gia/moi` in the protected buyer area. Kept its task order and added a reveal around later date, destination and household selection fields. The public screenshot shows the required sign-in redirect, not the authenticated form. Existing form regressions verify the changed field group. |
| Trace | Widened the desktop notebook and paired the real journal with the SVG companion from GH#300. Added reveals to the heading and household sections. |
| Sign in | Kept the kiln composition required by DESIGN.md. The shared auth shell reveals form content only when it starts below the viewport. |
| Sign up | Uses the same auth-shell behavior. Initially visible fields remain visible during hydration. |

The shared `section-tail` token replaces the oversized combination of page-bottom padding and footer margin. It ranges from 48 to 96 pixels. Interior section spacing remains available for long-form content. Credits, privacy and loading layouts use the same ending token.

`Reveal` defaults to visible server-rendered content. It arms only below the viewport and runs once. The CSS changes opacity and transform. Reduced motion disables reveals and hover lift. List items keep their semantic list structure, and existing form validation, navigation and journal records retain their behavior.

## Screenshots

Each pair links to a full-page JPEG. Desktop captures are 1440 by 900 pixels and phone captures are 390 by 844 pixels before full-page expansion.

| Page | Before 1440 | After 1440 | Before 390 | After 390 |
| --- | --- | --- | --- | --- |
| Home | [Before](before/before--home--1440.jpg) | [After](after/after--home--1440.jpg) | [Before](before/before--home--390.jpg) | [After](after/after--home--390.jpg) |
| Product list | [Before](before/before--san-pham--1440.jpg) | [After](after/after--san-pham--1440.jpg) | [Before](before/before--san-pham--390.jpg) | [After](after/after--san-pham--390.jpg) |
| Product detail | [Before](before/before--san-pham-detail--1440.jpg) | [After](after/after--san-pham-detail--1440.jpg) | [Before](before/before--san-pham-detail--390.jpg) | [After](after/after--san-pham-detail--390.jpg) |
| Artisan list | [Before](before/before--nghe-nhan--1440.jpg) | [After](after/after--nghe-nhan--1440.jpg) | [Before](before/before--nghe-nhan--390.jpg) | [After](after/after--nghe-nhan--390.jpg) |
| Household | [Before](before/before--nghe-nhan-detail--1440.jpg) | [After](after/after--nghe-nhan-detail--1440.jpg) | [Before](before/before--nghe-nhan-detail--390.jpg) | [After](after/after--nghe-nhan-detail--390.jpg) |
| Map | [Before](before/before--ban-do--1440.jpg) | [After](after/after--ban-do--1440.jpg) | [Before](before/before--ban-do--390.jpg) | [After](after/after--ban-do--390.jpg) |
| News list | [Before](before/before--tin-tuc--1440.jpg) | [After](after/after--tin-tuc--1440.jpg) | [Before](before/before--tin-tuc--390.jpg) | [After](after/after--tin-tuc--390.jpg) |
| News article | [Before](before/before--tin-tuc-detail--1440.jpg) | [After](after/after--tin-tuc-detail--1440.jpg) | [Before](before/before--tin-tuc-detail--390.jpg) | [After](after/after--tin-tuc-detail--390.jpg) |
| Quote request, signed out | [Before](before/before--bao-gia--1440.jpg) | [After](after/after--bao-gia--1440.jpg) | [Before](before/before--bao-gia--390.jpg) | [After](after/after--bao-gia--390.jpg) |
| Trace | [Before](before/before--truy-xuat--1440.jpg) | [After](after/after--truy-xuat--1440.jpg) | [Before](before/before--truy-xuat--390.jpg) | [After](after/after--truy-xuat--390.jpg) |
| Sign in | [Before](before/before--dang-nhap--1440.jpg) | [After](after/after--dang-nhap--1440.jpg) | [Before](before/before--dang-nhap--390.jpg) | [After](after/after--dang-nhap--390.jpg) |
| Sign up | [Before](before/before--dang-ky--1440.jpg) | [After](after/after--dang-ky--1440.jpg) | [Before](before/before--dang-ky--390.jpg) | [After](after/after--dang-ky--390.jpg) |

## Reproduce

Run from `tests/e2e`, with the production baseline on port 3011 and the current production build on port 3001:

```sh
node scripts/audit-301.mjs --base http://localhost:3011 --out ../../docs/design/audits/301/before --label before
node scripts/audit-301.mjs --base http://localhost:3001 --out ../../docs/design/audits/301/after --label after
CHROME_PATH=/path/to/chrome node scripts/lighthouse-301.mjs
```

`public-routes.mjs` supplies the route inventory. `before-routes.json` and `after-routes.json` record HTTP status, final URL, viewport width, document width, decoded screenshot dimensions and the separate 360-pixel document-width probe. The capture fails on unsuccessful navigation, an unexpected route, horizontal overflow or an image width that differs from the requested width. The quote-request entry explicitly expects sign-in and verifies the exact `next` destination. An independent source review confirmed the navigation and width checks.

Authenticated quote-form screenshots were not available in this environment. The earlier audit incorrectly described the signed-out redirect as the form. The final matrix labels that state explicitly. This limits the visual evidence for the quote form; the existing RFQ and map regression run passed 52 tests after the wrapper correction.

`lighthouse.json` retains individual results, settings and comparison medians. Lighthouse uses its default mobile throttling against production builds. The public API and remote image responses remain sources of variation. The runner supports `LIGHTHOUSE_APPEND=1` to retain earlier results while extending the paired comparison. It skips only a specific page, version and run that already exists.

## Validation

The serialized workspace test run passed all 18 tasks, including 830 web tests. Lint passed with five pre-existing warnings in untouched code. Both production builds passed. The existing QR and exhibition Playwright suites passed all 11 tests across Vietnamese and English. Later individual-card refinements passed the 25 relevant catalog and news tests and a fresh production build.

The standards and specification reviews ran separately. The duplicate route inventory, repeated observer selection, missing product-detail reveals and ineffective quote-form wrapper were corrected and rechecked.

## Initial production Lighthouse results

Five paired runs per page produced 30 measurements with Lighthouse 13.6.0, default mobile throttling, the same Chromium executable and sequential browser execution. The first two pairs preceded the final summary WebGL guard; that guard affects desktop animation, while the mobile benchmark uses the static summary. All five pairs remain in the reported medians rather than discarding earlier scores.

| Page | Performance before | Performance after | CLS before | CLS after | LCP before | LCP after | TBT before | TBT after |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 62 | 65 | 0.0008 | 0.0008 | 2635 ms | 1320 ms | 3481 ms | 3501 ms |
| Product detail | 51 | 52 | 0.0008 | 0.0008 | 4752 ms | 4833 ms | 2578 ms | 2525 ms |
| Household | 53 | 52 | 0.0008 | 0.0008 | 4454 ms | 4761 ms | 2793 ms | 2521 ms |

This initial comparison showed a household performance median one point lower and prompted the repair below. Individual household scores ranged from 50 to 56 on both versions. The historical measurements remain here; the fresh comparison against current develop is reported under Repaired Lighthouse comparison.

The household's LCP element is the same eager, high-priority hero photograph in both versions. In the fifth pair, measured TTFB increased from 970 to 1312 ms, resource-load delay fell from 116 to 57 ms, resource-load duration fell from 318 to 244 ms, and element-render delay rose from 214 to 282 ms. This supports further controlled investigation of response timing, but does not establish the cause of the score difference. The full-report breakdown is a measured navigation breakdown and is distinct from Lighthouse's simulated LCP above.

All 48 final screenshots passed decoded-width and route checks. Both reports contain 24 captures; every 360-pixel document-width probe passed. The quote-request capture explicitly records the expected signed-out redirect. No authenticated quote-form screenshot is claimed.

## PR repair and request amplification

The PR was rebased onto `develop` at `774e791e`. The product-grid and household-list conflicts preserve upstream eager loading for the first four products and first two household covers, alongside the shared reveals and spacing changes.

A fixed-latency local API fixture exposed duplicate server reads. One successful household page response made four identical API requests. Metadata and the page share the same public household, but the fetch helper supplies a new abort signal on each call, preventing automatic fetch memoization. Repeated rendering amplified those reads further on the not-found path.

`fetchHousehold` now uses React `cache()` to share its promise within one server render. The underlying request still uses `cache: 'no-store'` and its four-second timeout. React starts a new memoization scope for each request. This reduces duplicate reads without adding an application cache that could conceal a suspension.

The regression probe runs through an actual production Next.js response, not a mocked React dispatcher. It requests the household twice, then makes the local fixture return not-found and requests it again. The output records API-call counts, document timing and whether the household is present. Only the local fixture changes state; no remote household is suspended.

```sh
# From tests/e2e. Start the fixture, then start a production web build with
# API_INTERNAL_URL=http://127.0.0.1:4018/api/v1.
node scripts/household-perf-fixture.mjs
PERF_WEB_URL=http://localhost:3008 node scripts/inspect-household-requests.mjs
```

The Lighthouse runner also accepts `LIGHTHOUSE_BEFORE_URL`, `LIGHTHOUSE_AFTER_URL`, `LIGHTHOUSE_OUTPUT` and `LIGHTHOUSE_PAGES`. It alternates execution order within pairs and can fail on a median performance or CLS regression with `LIGHTHOUSE_ASSERT_NO_REGRESSION=1`. Historical measurements remain in `lighthouse.json`; repair measurements use a separate output file.

The request-count probe fails against the current `develop` production build and passes against the repaired production build:

| Page request | API reads on develop | API reads after repair | Fresh public state |
| --- | --- | --- | --- |
| First successful response | 4 | 1 | Household visible |
| Next successful response | 4 | 1 | Household fetched again |
| Next response after fixture suspension | 6 | 2 | HTTP 404, household absent |

The not-found path starts a separate Next.js error render, which gets its own React memoization scope. The successful-response check requires one read; the suspension check independently requires that the household disappear on the next request. Raw observations are in `household-requests-before.json` and `household-requests-after.json`.

An independent code review found no concrete regressions in the memoization or the two conflict resolutions. Forty-six focused tests passed, including catalog, images, moderation visibility, exhibition and motion. Both production builds passed.

## Repaired Lighthouse comparison

A fresh comparison uses current `develop` at `774e791e` and the repaired UI source, with separate production servers against the same live public API. Five alternating before/after pairs per route produced 30 new measurements. Historical results were not appended or discarded to select scores. The full data is in `lighthouse-repaired.json`.

| Page | Performance on develop | Performance after repair | CLS on develop | CLS after repair | LCP on develop | LCP after repair | TBT on develop | TBT after repair |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | 63 | 68 | 0.0008 | 0.0008 | 1537 ms | 1239 ms | 2941 ms | 3141 ms |
| Product detail | 51 | 51 | 0.0008 | 0.0008 | 4790 ms | 4898 ms | 2850 ms | 2488 ms |
| Household | 52 | 52 | 0.0008 | 0.0008 | 4792 ms | 4846 ms | 2697 ms | 2901 ms |

The median performance and CLS gate passes for all three routes. These are fresh matched comparisons against the updated base, not a claim that the original household score of 53 increased. LCP and TBT still vary, and the results do not show that every timing improved. The deterministic improvement is successful household reads falling from four to one within a response, while retaining fresh data on the next request.

Reproduce from `tests/e2e`, with current develop on port 3019 and repaired UI on port 3008:

```sh
LIGHTHOUSE_BEFORE_URL=http://localhost:3019 \
LIGHTHOUSE_AFTER_URL=http://localhost:3008 \
LIGHTHOUSE_OUTPUT=../../docs/design/audits/301/lighthouse-repaired.json \
LIGHTHOUSE_RUNS=5 LIGHTHOUSE_ASSERT_NO_REGRESSION=1 \
CHROME_PATH=/path/to/chrome node scripts/lighthouse-301.mjs
```

The final serialized workspace run passed all 18 tasks, including 904 web tests on the updated base. The 11 production QR/exhibition browser checks passed, and lint passed with five existing warnings. GitHub quality, MySQL/PostgreSQL integration, end-to-end and Vercel checks passed on the code update. The PR is mergeable against current develop.

The authenticated quote-form screenshot limitation remains documented above. Its public route continues to show the expected sign-in redirect.
