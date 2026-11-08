---
name: vCraft
description: A small warm museum for one Vietnamese craft village, sealed with the maker's imprint.
colors:
  paper: "#f5efe4"
  surface: "#fbf8f2"
  ink: "#1c1814"
  ash: "#6b635a"
  clay: "#a8482a"
  glaze: "#1e3a6e"
  seal: "#c2261c"
  celadon: "#5e8a7d"
  lacquer: "#8c6a24"
  kiln-hot: "#e89252"
typography:
  display:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(3.5rem, 2.5rem + 5vw, 7rem)"
    fontWeight: 600
    lineHeight: 1.02
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2.5rem, 2.0714rem + 2.1429vw, 4rem)"
    fontWeight: 600
    lineHeight: 1.08
    letterSpacing: "-0.02em"
  h2:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(2rem, 1.7857rem + 1.0714vw, 2.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  h3:
    fontFamily: "Fraunces, Georgia, serif"
    fontSize: "clamp(1.5rem, 1.3929rem + 0.5357vw, 1.875rem)"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  body:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "clamp(1rem, 0.9821rem + 0.0893vw, 1.0625rem)"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Be Vietnam Pro, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  input: "4px"
  card: "12px"
  chip: "999px"
spacing:
  gutter: "clamp(1rem, 0.4286rem + 2.8571vw, 3rem)"
  section: "clamp(4rem, 2.2857rem + 8.5714vw, 10rem)"
  container-editorial: "90rem"
  container-prose: "42rem"
components:
  button-primary:
    backgroundColor: "{colors.clay}"
    textColor: "{colors.paper}"
    rounded: "{rounded.input}"
    padding: "0 20px"
    height: "44px"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "0 20px"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.input}"
    padding: "0 12px"
    height: "44px"
  button-seal:
    backgroundColor: "{colors.seal}"
    textColor: "{colors.paper}"
    rounded: "{rounded.input}"
    padding: "0 20px"
    height: "44px"
  card-glazed:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "20px"
---

# Design System: vCraft

## Overview

**Creative North Star: "The Warm Little Museum"**

vCraft looks like a small museum, not a store. Paper backgrounds carry grain, ink text stays quiet, and large soft serif headlines leave room for hands and clay. The interface steps back so workshop photos, artisan portraits, and kiln stories lead.

Density shifts by role. Public pages use an editorial rhythm with wide gutters and deep section spacing. Workshop and admin tools tighten up, keep paper surfaces, and keep motion to short state feedback. Vietnamese is the default voice throughout.

The sign-in family (sign in, sign up, forgot and reset password, invitation, household wizard) is the one place the museum opens its kiln. Each of these pages stands a glazed tile in front of a kiln mouth: the scene glows from below, the seal sits beside the tile, and a successful sign-in stamps the trace seal before the browser moves on. This is the kiln auth surface. It is a state-driven scene, not a new visual world, and it follows the same paper, ink, clay and glaze roles as every other page.

**Key Characteristics:**
- Paper first, never pure white
- Soft serif headlines paired with a Vietnamese-first sans body
- The seal mark and trace frame as the recurring signature
- Warm, restrained motion shaped by clay, kiln, and spread
- Kiln auth surface: glow, glazed tile and a stamped confirmation, only on the sign-in family
- Hoa lam brush ornaments (cobalt, drawn on) as the one ornament that frames a tile

## Colors

Paper and ink do most of the work. Fired clay marks the primary action, glaze blue carries headlines and contrast blocks, and seal red stays rare for authentication and commitment.

### Primary
- **Fired Clay** (#a8482a): Main action color. Primary buttons, links, active states, and progress already completed.
- **Glaze Blue** (#1e3a6e): Headlines h1 through h3, blue pattern bands, contrast blocks, focus outlines, and the hoa lam brush ornaments.
- **Seal Red** (#c2261c): Authentication and decisive commitment only. Trace frames, seal marks, halted states, confirm tones, and the error ring on a kiln tile.

### Secondary
- **Celadon** (#5e8a7d): Open workshops and success, used at large sizes or as icon and badge fills.
- **Lacquer Gold** (#8c6a24): Certificates and artisan honors, used at 18px and above. On the kiln surface it also paints the fine ember dots.
- **Kiln Hot** (#e89252): The light core of the kiln glow. It appears only on the kiln auth surface (scene glow, seal halo, field underline, firing button). Never as text, never as a button fill.

### Neutral
- **Dó Paper** (#f5efe4): Main page background.
- **Surface** (#fbf8f2): Cards, dialogs, raised panels on paper, and the glazed tile of the kiln surface.
- **Ink** (#1c1814): Main text.
- **Kiln Ash** (#6b635a): Secondary text and captions.

Night Kiln dark mode remaps the same roles: charcoal paper (#14110f), raised surface (#1f1a16), ember clay (#e2703a), bright glaze (#8fb0e6), light seal (#f06a55), and on the kiln surface a bright hot core (#ffb070). The kiln scene in dark mode is the charcoal ground with an ember glow rising from below; the light scene is dó paper with a faint clay glow.

The kiln scene's fine ember dots draw from a small slot set: clay and lacquer and seal in light, and tints of the hot core and ember clay in dark (#ffd8a6, #ffb070, #ff9a55, #e2703a, #c75a2c; light slot #b8683f). These are scene-only tints of the palette above. They do not become palette roles.

### Named Rules
**The Rare Seal Rule.** Seal red covers no more than 5 percent of a screen. Its scarcity gives weight to stamps, verification, and final acceptance.

**The Firing Light Rule.** Kiln glow, ember dots, heat shimmer and the hot core belong to the kiln auth surface and its firing, error and sealed states. They are never decoration on any other page.

## Typography

**Display Font:** Fraunces, with Georgia and serif fallback
**Body Font:** Be Vietnam Pro, with system-ui and sans-serif fallback
**Label/Mono Font:** JetBrains Mono, with ui-monospace and monospace fallback

**Character:** Soft serif headlines with high SOFT axis carry warmth and craft. The sans body stays plain and legible for Vietnamese diacritics. Mono marks trace codes, RFQ codes, and hashes as technical facts.

### Hierarchy
- **Display** (semibold, clamp 3.5 to 7rem, 1.02): Hero headlines and large museum numbers only.
- **Headline** (semibold, h1 clamp 2.5 to 4rem at 1.08, h2 clamp 2 to 2.75rem at 1.15): Page and section titles in glaze blue.
- **Title** (semibold, h3 clamp 1.5 to 1.875rem, 1.25): Card titles and dialog titles in glaze blue.
- **Body** (regular, clamp 1 to 1.0625rem, 1.65): Default reading text. Long reading columns cap at 42rem.
- **Label** (medium, 0.875rem, 1.5): Buttons, nav items, badges, and table cells.
- **Kiln tagline** (h2 size, semibold, SOFT 100, 1.15, ink; lg and up only): The one display line of the kiln scene, set beside the seal in ink rather than glaze, with its trailing full stop dropped. The small line under it is body size in a mix of ash toward ink, so it reads on the glow.
- **Stamp line** (h3 size, weight 560, 1.25, -0.01em, SOFT 100 and WONK 0, glaze, balanced wrap): The success line under the stamped seal on the kiln tile. Its copy is `auth.kiln.sealed`: "Sealed. Opening the kiln…" in English and "Đã đóng ấn. Đang mở cửa lò…" in Vietnamese. Weight 560 sits between Title and the 600 headings; it is used only here.

### Named Rules
**The Soft Headline Rule.** Large headlines use Fraunces with SOFT 100 and negative tracking. Body copy never uses the display face.

## Layout

The public site uses a 12 column editorial grid inside a 1440px frame. Page gutters run fluid from 16 to 48px, sections stack with 64 to 160px rhythm, and compositions favor asymmetry with one large image against a narrow text block. Standard image ratios are 4:5 for products, 3:2 for workshops, 3:4 for portraits, and 1:1 for thumbnails.

Household profiles use bento blocks for story, certificates, map, and lineage. Traceability pages read as a craft notebook on phones. Maps pair a paper toned basemap with seal pins and a list panel, collapsing to a bottom sheet on mobile. Admin pages use a 14rem sidebar on desktop that becomes a horizontal strip on narrow screens.

The kiln auth surface is a full-bleed scene between the sticky header and the footer, stopping 2.5rem short of the fold so the footer wave peeks in. From `lg` (1024px) it is a 12-column layout: the seal and tagline in columns 1 to 6 and the tile on columns 8 to 12 at 440px (27.5rem), vertically centred. Below `lg` the 72px seal sits above a full-width tile, and the tagline is hidden. Wide flows (the household wizard) put a 72px seal above a `max-w-3xl` tile at every width. The tile takes 20px padding and 32px from `md`. The brush curl peeks from the top right on phones.

## Elevation & Depth

Depth comes from tonal layering and one warm shadow, not stacked elevation. Cards sit on surface fields over paper with a thin ink ring. Grain adds material. Crackle marks verification zones, empty states, and the error state of a kiln tile.

On the kiln auth surface, depth also comes from light: the tile is an opaque surface with a glaze rim, and the state glows below are the only shadows that do not come from the warm lift.

### Shadow Vocabulary
- **Warm lift** (`0 1px 0 rgb(28 24 20 / 0.04), 0 12px 32px -12px rgb(120 60 30 / 0.18)`): Cards, dropdown menus, and dialogs at rest. In dark mode it is `0 1px 0 rgb(241 233 220 / 0.05), 0 12px 32px -12px rgb(0 0 0 / 0.55)`.
- **Kiln fire glow** (`inset 0 1px 0 rgb(255 255 255 / 0.18), 0 0 0 1px rgb(232 146 82 / 0.45), 0 4px 16px 0 rgb(168 72 42 / 0.4)`): The `::before` layer of the primary button in the firing state, on the kiln surface only. Dark mode uses a `0.5` hot ring, a `4px 18px` ember glow at `0.6`, and adds `0 8px 24px -10px rgb(255 176 112 / 0.45)`.
- **Kiln error ring** (`0 0 0 1px rgb(194 38 28 / 0.5), 0 8px 30px -4px rgb(194 38 28 / 0.3)`, added to the warm lift): The tile's rim while the error state is on. It is removed when the state clears.
- **Seal glow** (`filter: drop-shadow(0 0 5px rgb(232 146 82 / 0.5))`): A filter on the kiln seal mark, not a box shadow. The stamped seal uses `drop-shadow(0 0 10px rgb(194 38 28 / 0.45))`.

### Named Rules
**The Flat-By-Default Rule.** Surfaces stay flat at rest. Shadow appears only on cards, menus, and dialogs, never as decoration on plain content. The kiln state glows are the one exception, and they appear only as a response to a firing, error or sealed state on the kiln surface.

## Shapes

Corners stay small and deliberate. Inputs and buttons use a 4px corner, cards use 12px, and chips and badges use a full pill. The seal family breaks this geometry on purpose with uneven hand cut squares for the logomark, the trace frame, and the QR stamp.

Borders are thin ink lines at 5 to 20 percent opacity. The blue wave divider separates sections. Crackle and grain supply texture, never structure.

The kiln tile keeps the 12px card corner and adds a 1px glaze rim: a gradient line along the edge, brightest at the top left (0.62 alpha light, 0.85 dark) and fading to 0.14 light (0.16 dark) across the middle. Hoa lam brush ornaments hang off the tile in cobalt, outside its edge. They are the only brush-pressed shapes that frame a card.

## Components

### Buttons
- **Shape:** Slightly rounded rectangle (4px radius).
- **Primary:** Fired clay fill with paper text, 44px height, 20px horizontal padding. Darkens toward ink on hover, presses to 97 percent scale with a light spring.
- **Hover / Focus:** Color transition over 160ms with the press easing. Focus shows a 2px glaze outline offset by 2px.
- **Secondary / Ghost / Seal:** Secondary uses a thin ink border on transparent fill. Ghost has no border and washes ink at 6 percent on hover. Seal variant uses seal red for verification and final acceptance.
- **Kiln primary (sign-in family):** The primary button keeps its clay fill and adds a faint hot gradient along its bottom edge at rest (`--kiln-btn-rest`). In the `firing` state (`data-kiln="firing"` on the button or `data-kiln-state="firing"` on the tile) a glow layer under the label cross-fades in over 160ms with ease.clay: a hot core over the clay, with the fire shadow above. The label colour does not change, so the text keeps 4.5:1. No background is swapped.

### Chips
- **Style:** Full pill, 999px radius, small medium text.
- **State:** Seven tones map to meaning: neutral, clay, glaze, celadon for open and success, lacquer for honors, seal for verification, outline for revisions.

### Cards / Containers
- **Corner Style:** Gently rounded card (12px radius).
- **Background:** Surface field on paper.
- **Shadow Strategy:** Warm lift shadow plus a 1px ink ring at 5 percent.
- **Border:** Ring only, no hard border.
- **Internal Padding:** 20 to 24px in tools, looser in editorial zones.

### Glazed Card (kiln auth tile)
- **Character:** An opaque glazed tile in front of the kiln mouth. It is the only card that carries a glaze rim and a pointer sheen. Ordinary content still uses the card above.
- **Background and text:** Surface fill with ink text, so every run keeps AA contrast on the glow.
- **Rim and sheen:** A 1px glaze gradient rim on the edge and a fixed radial sheen layer (420 by 360px, clipped to the tile). The sheen rests at 15 percent and 9 percent of the tile. On a mouse-like fine pointer with motion allowed, `kiln-surface.tsx` moves it with `translate3d` written straight to the style, at most once per frame. It glides home over 280ms ease.clay when the pointer leaves. Touch never moves it.
- **Padding:** 20px, 32px from `md`. A wide flow keeps the same padding at `max-w-3xl`.
- **States:** The tile has four `data-kiln-state` values, see Feedback Vocabulary below.

### Seal Column (kiln auth tile)
- **Shape:** KilnSeal, the vase seal inside the hand cut double frame over a crackle ground. 72px on phones and in wide flows, 240px from `lg` on the sign-in layout. Decorative and `aria-hidden`.
- **Glow:** Two halo layers cross-fade by opacity (280ms ease.clay). The base halo rests at the theme halo, the hot halo sits over it. The seal is `data-kiln="hot"` while firing, which brightens the hot halo. It is `data-kiln="cool"` after an error, which dims the base halo to 0.35. The ember rim is two blurred strokes under the crisp frame.
- **Tilt:** The seal rests at -2 degrees.

### Stamp (sealed state)
- **Ink bleed:** A 190px ring of seal red radial gradient, roughened by a fractal turbulence displacement, behind the stamped seal.
- **Seal:** SealMark at 104px, rotated -5 degrees, with `--animate-stamp`: 520ms ease.press from scale 1.4 and -6 degrees to 1 and 0, visible from 60 percent of the run.
- **Ghost:** A dashed seal outline at 55 percent opacity that fades in over 280ms, starting at 100ms.
- **Line:** The stamp line fades in over 280ms, starting at 160ms.
- **Body:** The form region fades out and hides over 280ms once the state starts. It fades back in if the state ends.

### Brush Ornaments (hoa lam)
- **Components:** `BrushVine` and `BrushLotus` (the vine climbs the left edge and its lotus bloom sits in the scroll, `xl` and up only, not on the wide flow), `BrushCurl` (top right; `compact` arches over the top edge for narrow hosts), and `BrushWaveBand` (hangs under the host, fading out to the left). Each is an absolutely positioned 1px anchor with visible overflow, placed on a `relative` host. They draw in glaze with `currentColor`.
- **Pressed look:** Each motif is filled brush presses. Its ink is `--brush-ink-opacity` (0.82 light, 0.64 dark) and its wash is `--brush-wash-opacity` (0.24 light, 0.17 dark). A roughening displacement filter gives the edges a rough hand, plus a few pits where the ink did not take. The geometry is static and generated; it is not edited by hand.
- **Draw-on rule:** Each press is revealed by a mask whose centreline is stroked in white with `pathLength = 1`. Its `stroke-dashoffset` runs from 1.05 to 0 over 900ms with ease.clay (`dur.story`). It starts after `--brush-delay` (120ms) plus 40ms per stagger index (0 to 11). The dots fade in over 520ms, starting 480ms after the delay. The dash is `1 2` so no round-cap dot shows before the stroke starts.
- **Once per page:** The loading shell (`ornaments` off) leaves the ornaments out, so the draw-on is not replayed when the page arrives.
- **Reduced motion:** The art is drawn in full and only fades in, over 150ms linear.

### Feedback Vocabulary (kiln auth tile)
The tile carries one `data-kiln-state` at a time (`firing`, `error`, `invalid`, `sealed`). The seal carries `data-kiln` for its mood (`hot`, `cool`). The button can carry `data-kiln="firing"`. The forms call four functions, fire, fail, seal and reset, and never touch the DOM themselves.

- **Firing** (submit started): the button's fire glow comes up over 160ms; the seal is hot; embers stream from the button to the seal in about 520ms on ease.kiln (the quick burst that lands with the stamp takes about 400ms). The state stays until the outcome.
- **Error** (server or auth failure): the card shakes once, at most 6px across 280ms (`dur.base`, linear between peaks), and the crackle layer flashes over 900ms (`dur.story`, ease.clay, opacity to 0.95 at 18 percent and back to 0). The tile takes the error ring and the seal cools. The state clears at `animationend` of the crackle, or after a 1100ms backstop.
- **Invalid** (client validation, nothing sent): the shake alone, with no crackle, no seal change. It clears after a 400ms backstop.
- **Sealed** (success): the stamp runs its 520ms hold (`dur.slow`), the success line is announced through a live region, and the browser prerenders the destination in the meantime (Speculation Rules, skipped under save-data). The form then navigates with `location.assign`. An interrupting call (fire, fail, reset) settles the hold early, so the caller never waits forever. A failed or interrupted sign-in withdraws the prerender hint.
- **Reset:** any flow that ends without a stamp clears the tile. A page restored from the back/forward cache (`pageshow` with `persisted`) is reset, so a stamped tile never stays dead.
- **Crackle fade-out:** if the error ends early, the crackle is frozen at its current opacity and fades out over 280ms instead of being cut.

### Reduced Motion (kiln and brush contract)
Reduced motion follows BRAND §6.4. The global token override sets `--duration-base`, `--duration-slow` and `--duration-story` to 150ms, makes `--duration-quick` instant, and turns the stamp into a 150ms linear opacity fade.

- **Scene:** Static art. The ember drift stops, the heat shimmer does not move, and the WebGL island is never mounted. An island already on screen unmounts when reduced motion turns on.
- **Tile:** No shake. The error becomes a crackle fade to 0.6 opacity over 150ms, held for 900ms before it clears. The sealed state fades the seal, line and ghost over 150ms linear; the body fades out in 150ms.
- **Fields and button:** Ember underline and border colour change over 150ms linear without the scale. The fire glow fades over 150ms.
- **Sheen:** Still. No transition.
- **Brush:** Fully drawn, fades in over 150ms.
- **View transition:** Not declared, so no cross-document transition runs.

### Inputs / Fields
- **Style:** 4px corner, ink border at 20 percent, paper or surface fill, 40 to 44px height. Inside the kiln tile the fill is paper at 64 percent mixed into surface, and the border is ink at 24 percent (38 percent on hover-capable pointers).
- **Focus:** Glaze outline treatment consistent with buttons (2px, offset 2px, `focus-visible`). Inside the kiln tile, a field also gets an **ember underline**: a 2px gradient from clay through hot to clay, fading to transparent at both ends, brightest in the middle, that grows from the centre (`scaleX` 0.25 to 1 over 160ms ease.clay). A soft hot glow sits under the field, blurred 3px. Both show on `focus-within`, so a mouse click lights the underline too.
- **Error / Disabled:** Error shifts border and text to seal red. Disabled drops interaction and dims to 45 percent opacity.

### Navigation
- Public header is sticky with blurred paper, logo left, quiet sans links, and a no-JS details menu on narrow screens. Admin nav is vertical in the sidebar and horizontal scroll on narrow screens, with the active item in clay on a clay wash. Skip links appear on focus in ink on paper. Locale switching sits beside the menu.

### Signature Component
TraceSealFrame wraps a QR code in a double seal frame with an 8 character mono code below. SealMark renders the hand cut seal with a garlic vase cutout and a blue wave band, with ink and inverse variants for print and dark blocks.

### View Transition (cross-document)
- **Scope:** Only the navigation that follows a sealed sign-in animates. Every page opts in with `@view-transition { navigation: auto }` under `prefers-reduced-motion: no-preference`, but a `pageswap` guard in the root layout (`lib/view-transition.ts`) skips the transition for any other hard navigation. The guard lets the transition run only when the leaving document carries `data-kiln-vt`, which the sealed state sets and clears.
- **Motion:** A plain cross-fade on the root, opacity only: the old root fades out and the new one fades in, each 280ms on ease.clay (`--duration-base`). No scale, so the sticky header does not move.
- **Soft navigation:** Next.js `<Link>` and `router.push` never reload the document, so no cross-document transition runs for them. Nothing on the site calls `document.startViewTransition`.

## Do's and Don'ts

Concrete visual guardrails grounded in the incumbent implementation and docs/design/BRAND.md.

### Do:
- **Do** keep paper as the page ground and reserve pure white for no permanent surface.
- **Do** set headlines in Fraunces with SOFT 100 and glaze blue.
- **Do** save seal red for stamps, verification, halted states, final confirmation, and the error ring of a kiln tile.
- **Do** pair photos with grain, crackle, or wave ornaments at section breaks.
- **Do** collapse motion to a 150ms fade when reduced motion is requested.
- **Do** draw hoa lam brush ornaments on with the draw-on rule (900ms, 40ms stagger), and leave them out of the loading shell so they are not replayed.
- **Do** keep the kiln state vocabulary to its four states (firing, error, invalid, sealed) and its durations, and announce the sealed line through its live region.
- **Do** keep the sealed line copy in the message catalogue: "Sealed. Opening the kiln…" (en) and "Đã đóng ấn. Đang mở cửa lò…" (vi).

### Don't:
- **Don't** use seal red for ordinary buttons, links, or decoration.
- **Don't** set body copy or tables in Fraunces.
- **Don't** add shadows beyond the warm lift token and the kiln state glows named above.
- **Don't** put the kiln glow, ember dots or the glazed tile on any page outside the sign-in family.
- **Don't** swap a button's background for its firing state; cross-fade the glow layer.
- **Don't** replay the brush draw-on on the loading shell, or draw it for reduced motion.
- **Don't** invent households, makers, prices, reviews, or certifications in visual examples.
- **Don't** use loud marketplace patterns such as discount banners or flashing badges.
