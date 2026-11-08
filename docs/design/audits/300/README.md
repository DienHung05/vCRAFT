# Product production journal, GH#300

The trace page pairs the published production journal with a category-specific SVG illustration. The product summary links each of the seven canonical stages to its journal entry. Stages that have no entry are labeled as unrecorded. The illustration describes a kind of pottery and does not claim to depict the exact product.

The original entries, correction anchors, declared dates, notes, attached photos and integrity verifier stay in the document. The household attribution identifies who published the journal. It does not attribute every stage to an artisan or workshop when the journal has no such field.

On screens at least 1024 pixels wide, with motion allowed and the existing capability check reporting WebGL, scrolling selects the entry at the reading line. Keyboard focus selects its entry until the visitor resumes scrolling. `aria-current="step"` identifies the current entry. A sticky companion shows clay, shaping, drying, painting, glazing, firing and finishing. The SVG implementation downloads no three.js code.

Phones, reduced motion, no JavaScript and unavailable WebGL use the static journal. The SVG animation uses transform and opacity. Stage colors change without a color animation. No continuous animation loop or scroll handler runs.

## Reproduce browser observations

Build and start the web application against a public API, then run from `tests/e2e`:

```sh
E2E_BASE_URL=http://localhost:3001 node scripts/inspect-journey.mjs
```

The script records its server URL and observations in `observations.json` and takes screenshots for desktop, 390-pixel phone, 360-pixel phone, reduced motion, no JavaScript and no WebGL. It exercises keyboard focus and desktop scroll selection. It applies four-times CPU throttling after hydration and records long tasks separately from the page's cumulative layout shift. Long tasks are whole-page observations and cannot be attributed to the journey without a browser trace.

The screenshots use the public demonstration product `BT7K2QXM`. No production journal records are changed by this capture.

## Production browser results

The final observations used the production server on port 3001. All six modes retained seven journal entries and seven summary links. Trace and product pages had zero document overflow at every captured width. Keyboard focus selected the matching entry and left exactly one journal entry with `aria-current="step"`. Desktop scrolling selected clay, throw, dry, paint, glaze, fire and finish in order.

The companion appeared only on the motion-capable desktop. It stayed hidden on 390- and 360-pixel phones, reduced motion, no JavaScript and unavailable WebGL. The static journal remained readable in each case.

| Mode | Trace screenshot | Product summary | Whole-page CLS | Longest observed task during stage exercise at 4x CPU |
| --- | --- | --- | --- | --- |
| Desktop, 1440 pixels | [Journal](desktop.jpg) | [Summary](desktop-summary.jpg) | 0.0047 | No long tasks |
| Phone, 390 pixels | [Journal](phone.jpg) | [Summary](phone-summary.jpg) | 0.0447 | No long tasks |
| Phone, 360 pixels | [Journal](narrow-phone.jpg) | [Summary](narrow-phone-summary.jpg) | 0.0011 | No long tasks |
| Reduced motion | [Journal](reduced-motion.jpg) | [Summary](reduced-motion-summary.jpg) | 0.0021 | No long tasks |
| No JavaScript | [Journal](no-javascript.jpg) | [Summary](no-javascript-summary.jpg) | Not measured | Not measured |
| No WebGL | [Journal](no-webgl.jpg) | [Summary](no-webgl-summary.jpg) | 0.0021 | No long tasks |

These CLS values cover the trace page's navigation and exercise, including loading. The task observations cover the exercise after hydration. The final run recorded no long tasks in any JavaScript-enabled mode. An earlier desktop run recorded whole-page tasks up to 58 ms. These observations do not establish a universal 50 ms budget or attribute those earlier tasks to the journey. The phone exercises recorded no long tasks in both runs.

The final product-summary observation records `data-play` only on the capable desktop. Phones, reduced motion, no JavaScript and unavailable WebGL leave the summary static as well as the journal.

The existing QR and exhibition Playwright suites passed all 11 checks in Vietnamese and English, including integrity verification and the household's 360-pixel layout. A separate real-browser check of the bowl journal `DNENZF4C` showed the bowl silhouette, five actual entries, and explicit missing clay and glaze stages.
